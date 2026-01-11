import json
import os
import psycopg2
import requests
from datetime import datetime

def handler(event: dict, context) -> dict:
    """
    Telegram Bot webhook для обработки сообщений.
    Поддерживает команды и автоматическое скачивание медиа по ссылкам.
    """
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return cors_response()
    
    if method == 'POST':
        try:
            body = json.loads(event.get('body', '{}'))
            
            if 'message' not in body:
                return success_response({'ok': True})
            
            message = body['message']
            chat_id = message['chat']['id']
            text = message.get('text', '')
            user = message.get('from', {})
            
            bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
            if not bot_token:
                return error_response('Токен бота не настроен', 500)
            
            db_conn = get_db_connection()
            save_or_update_user(db_conn, user)
            
            if text.startswith('/'):
                handle_command(chat_id, text, bot_token, db_conn)
            elif is_telegram_url(text):
                handle_download(chat_id, text, bot_token, db_conn, user['id'])
            else:
                send_message(chat_id, 
                    '👋 Отправь мне ссылку на видео или фото из Telegram канала!\n\n'
                    '📝 Или используй команды:\n'
                    '/start - начать работу\n'
                    '/help - помощь\n'
                    '/stats - статистика',
                    bot_token
                )
            
            db_conn.close()
            return success_response({'ok': True})
            
        except Exception as e:
            print(f'Error: {str(e)}')
            return success_response({'ok': True})
    
    if method == 'GET':
        query_params = event.get('queryStringParameters', {})
        action = query_params.get('action', '')
        
        if action == 'set_webhook':
            bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
            webhook_url = query_params.get('url', '')
            
            if not webhook_url:
                return error_response('URL не указан', 400)
            
            result = set_webhook(bot_token, webhook_url)
            return success_response(result)
        
        return success_response({
            'status': 'active',
            'bot': 'TG Media Downloader Bot'
        })
    
    return error_response('Метод не поддерживается', 405)


def handle_command(chat_id: int, text: str, bot_token: str, db_conn):
    """Обработка команд бота"""
    command = text.split()[0].lower()
    
    if command == '/start':
        send_message(chat_id,
            '🚀 *Привет! Я бот для скачивания медиа из Telegram*\n\n'
            '📹 Отправь мне ссылку на видео или фото из любого канала, '
            'и я скачаю его для тебя!\n\n'
            '✨ *Возможности:*\n'
            '• Скачивание видео и фото\n'
            '• Кэширование популярных файлов\n'
            '• Статистика загрузок\n\n'
            '📝 *Команды:*\n'
            '/help - справка\n'
            '/stats - твоя статистика',
            bot_token,
            parse_mode='Markdown'
        )
    
    elif command == '/help':
        send_message(chat_id,
            '❓ *Как пользоваться ботом:*\n\n'
            '1️⃣ Найди нужное видео или фото в Telegram канале\n'
            '2️⃣ Скопируй ссылку на пост (Поделиться → Копировать ссылку)\n'
            '3️⃣ Отправь ссылку мне\n'
            '4️⃣ Получи файл!\n\n'
            '⚡ *Кэширование:* популярные файлы загружаются мгновенно\n\n'
            '📊 *Команды:*\n'
            '/start - начать работу\n'
            '/stats - статистика\n'
            '/help - эта справка',
            bot_token,
            parse_mode='Markdown'
        )
    
    elif command == '/stats':
        schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
        cursor = db_conn.cursor()
        
        cursor.execute(f"""
            SELECT downloads_count
            FROM {schema}.bot_users
            WHERE telegram_id = %s
        """, (chat_id,))
        
        row = cursor.fetchone()
        user_downloads = row[0] if row else 0
        
        cursor.execute(f"""
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE cached = true) as cached
            FROM {schema}.downloads
        """)
        
        stats = cursor.fetchone()
        total_downloads = stats[0] if stats else 0
        cached_files = stats[1] if stats else 0
        
        cursor.close()
        
        send_message(chat_id,
            f'📊 *Твоя статистика:*\n\n'
            f'📥 Твоих загрузок: *{user_downloads}*\n'
            f'⚡ В кэше: *{cached_files}* файлов\n'
            f'🌐 Всего загрузок: *{total_downloads}*\n\n'
            f'Продолжай пользоваться ботом! 🚀',
            bot_token,
            parse_mode='Markdown'
        )
    
    else:
        send_message(chat_id,
            '❌ Неизвестная команда. Используй /help для справки',
            bot_token
        )


def handle_download(chat_id: int, url: str, bot_token: str, db_conn, user_id: int):
    """Обработка запроса на скачивание"""
    
    send_message(chat_id, '⏳ Получаю файл из Telegram...', bot_token)
    
    existing = check_cache(db_conn, url)
    
    if existing and existing.get('file_id'):
        update_download_count(db_conn, existing['id'])
        update_user_downloads(db_conn, user_id, existing['id'])
        
        send_cached_media(chat_id, existing, bot_token)
    else:
        media_info = get_telegram_file(url, bot_token, chat_id)
        
        if media_info:
            download_id = save_to_database(db_conn, url, media_info)
            update_user_downloads(db_conn, user_id, download_id)
            
            send_downloaded_media(chat_id, media_info, bot_token)
        else:
            send_message(chat_id,
                '❌ *Ошибка загрузки*\n\n'
                'Не удалось получить медиа. Возможные причины:\n'
                '• Неверная ссылка\n'
                '• Канал недоступен\n'
                '• Бот не добавлен в канал\n'
                '• Файл удалён\n\n'
                '💡 Добавь бота в канал как администратора для доступа к файлам!',
                bot_token,
                parse_mode='Markdown'
            )


def is_telegram_url(text: str) -> bool:
    """Проверка является ли текст Telegram ссылкой"""
    return 't.me/' in text or 'telegram.me/' in text or text.startswith('tg://')


def send_message(chat_id: int, text: str, bot_token: str, parse_mode: str = None):
    """Отправка сообщения пользователю"""
    url = f'https://api.telegram.org/bot{bot_token}/sendMessage'
    payload = {
        'chat_id': chat_id,
        'text': text
    }
    
    if parse_mode:
        payload['parse_mode'] = parse_mode
    
    try:
        requests.post(url, json=payload, timeout=10)
    except Exception as e:
        print(f'Error sending message: {str(e)}')


def send_photo(chat_id: int, photo: str, bot_token: str, caption: str = None):
    """Отправка фото пользователю"""
    url = f'https://api.telegram.org/bot{bot_token}/sendPhoto'
    payload = {
        'chat_id': chat_id,
        'photo': photo
    }
    
    if caption:
        payload['caption'] = caption
        payload['parse_mode'] = 'Markdown'
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        return response.json()
    except Exception as e:
        print(f'Error sending photo: {str(e)}')
        return None


def send_video(chat_id: int, video: str, bot_token: str, caption: str = None):
    """Отправка видео пользователю"""
    url = f'https://api.telegram.org/bot{bot_token}/sendVideo'
    payload = {
        'chat_id': chat_id,
        'video': video
    }
    
    if caption:
        payload['caption'] = caption
        payload['parse_mode'] = 'Markdown'
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        return response.json()
    except Exception as e:
        print(f'Error sending video: {str(e)}')
        return None


def send_document(chat_id: int, document: str, bot_token: str, caption: str = None):
    """Отправка документа пользователю"""
    url = f'https://api.telegram.org/bot{bot_token}/sendDocument'
    payload = {
        'chat_id': chat_id,
        'document': document
    }
    
    if caption:
        payload['caption'] = caption
        payload['parse_mode'] = 'Markdown'
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        return response.json()
    except Exception as e:
        print(f'Error sending document: {str(e)}')
        return None


def set_webhook(bot_token: str, webhook_url: str):
    """Установка webhook для бота"""
    url = f'https://api.telegram.org/bot{bot_token}/setWebhook'
    payload = {'url': webhook_url}
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        return response.json()
    except Exception as e:
        return {'ok': False, 'error': str(e)}


def get_db_connection():
    """Подключение к базе данных"""
    dsn = os.environ.get('DATABASE_URL')
    return psycopg2.connect(dsn)


def save_or_update_user(conn, user: dict):
    """Сохранение или обновление пользователя"""
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    cursor = conn.cursor()
    
    cursor.execute(f"""
        INSERT INTO {schema}.bot_users (telegram_id, username, first_name, last_name, last_active)
        VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (telegram_id) 
        DO UPDATE SET 
            username = EXCLUDED.username,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            last_active = CURRENT_TIMESTAMP
    """, (
        user.get('id'),
        user.get('username'),
        user.get('first_name'),
        user.get('last_name')
    ))
    
    conn.commit()
    cursor.close()


def update_user_downloads(conn, telegram_id: int, download_id: int):
    """Обновление счетчика загрузок пользователя"""
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    cursor = conn.cursor()
    
    cursor.execute(f"""
        SELECT id FROM {schema}.bot_users WHERE telegram_id = %s
    """, (telegram_id,))
    
    user_row = cursor.fetchone()
    if user_row:
        user_id = user_row[0]
        
        cursor.execute(f"""
            INSERT INTO {schema}.user_downloads (user_id, download_id)
            VALUES (%s, %s)
        """, (user_id, download_id))
        
        cursor.execute(f"""
            UPDATE {schema}.bot_users
            SET downloads_count = downloads_count + 1
            WHERE id = %s
        """, (user_id,))
        
        conn.commit()
    
    cursor.close()


def check_cache(conn, url: str):
    """Проверка кэша"""
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    cursor = conn.cursor()
    
    cursor.execute(f"""
        SELECT id, file_path, thumbnail_url, file_size, media_type, title
        FROM {schema}.downloads
        WHERE url = %s AND cached = true
        LIMIT 1
    """, (url,))
    
    row = cursor.fetchone()
    cursor.close()
    
    if row:
        return {
            'id': row[0],
            'file_id': row[1],
            'thumbnail_url': row[2],
            'file_size': row[3],
            'media_type': row[4],
            'title': row[5]
        }
    return None


def update_download_count(conn, download_id: int):
    """Увеличение счетчика загрузок"""
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    cursor = conn.cursor()
    
    cursor.execute(f"""
        UPDATE {schema}.downloads
        SET download_count = download_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
    """, (download_id,))
    
    conn.commit()
    cursor.close()


def get_telegram_file(url: str, bot_token: str, forward_to_chat: int):
    """Получение файла из Telegram через пересылку"""
    import re
    
    match = re.search(r't\.me/([^/\?]+)/(\d+)', url)
    if not match:
        return None
    
    channel = match.group(1)
    message_id = match.group(2)
    
    from_chat = f'@{channel}' if not channel.startswith('-') else channel
    
    api_url = f'https://api.telegram.org/bot{bot_token}/forwardMessage'
    payload = {
        'chat_id': forward_to_chat,
        'from_chat_id': from_chat,
        'message_id': int(message_id)
    }
    
    try:
        response = requests.post(api_url, json=payload, timeout=15)
        result = response.json()
        
        if not result.get('ok'):
            return None
        
        message = result.get('result', {})
        
        if message.get('photo'):
            photo = message['photo'][-1]
            return {
                'type': 'photo',
                'title': f'Фото из {channel}',
                'file_id': photo['file_id'],
                'file_url': url,
                'size': photo.get('file_size', 0)
            }
        
        elif message.get('video'):
            video = message['video']
            return {
                'type': 'video',
                'title': f'Видео из {channel}',
                'file_id': video['file_id'],
                'file_url': url,
                'size': video.get('file_size', 0),
                'duration': video.get('duration', 0)
            }
        
        elif message.get('document'):
            doc = message['document']
            return {
                'type': 'document',
                'title': doc.get('file_name', f'Файл из {channel}'),
                'file_id': doc['file_id'],
                'file_url': url,
                'size': doc.get('file_size', 0)
            }
        
        return None
        
    except Exception as e:
        print(f'Error getting Telegram file: {str(e)}')
        return None


def send_cached_media(chat_id: int, media: dict, bot_token: str):
    """Отправка медиа из кэша"""
    caption = f'⚡ *Из кэша!*\n\n📄 {media["title"]}\n💾 Размер: {format_file_size(media.get("file_size", 0))}'
    
    media_type = media.get('media_type', 'photo')
    file_id = media.get('file_id')
    
    if not file_id:
        send_message(chat_id, caption, bot_token, parse_mode='Markdown')
        return
    
    if media_type == 'photo':
        send_photo(chat_id, file_id, bot_token, caption)
    elif media_type == 'video':
        send_video(chat_id, file_id, bot_token, caption)
    else:
        send_document(chat_id, file_id, bot_token, caption)


def send_downloaded_media(chat_id: int, media: dict, bot_token: str):
    """Отправка скачанного медиа"""
    caption = f'✅ *Готово!*\n\n📄 {media["title"]}\n💾 Размер: {format_file_size(media.get("size", 0))}'
    
    media_type = media.get('type', 'photo')
    file_id = media.get('file_id')
    
    if not file_id:
        send_message(chat_id, caption, bot_token, parse_mode='Markdown')
        return
    
    if media_type == 'photo':
        send_photo(chat_id, file_id, bot_token, caption)
    elif media_type == 'video':
        send_video(chat_id, file_id, bot_token, caption)
    else:
        send_document(chat_id, file_id, bot_token, caption)


def save_to_database(conn, url: str, media_info: dict) -> int:
    """Сохранение в базу данных"""
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    cursor = conn.cursor()
    
    file_id = media_info.get('file_id', '')
    
    cursor.execute(f"""
        INSERT INTO {schema}.downloads (url, media_type, title, file_path, file_size, thumbnail_url, cached)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        url,
        media_info['type'],
        media_info['title'],
        file_id,
        media_info.get('size', 0),
        media_info.get('thumbnail'),
        True
    ))
    
    download_id = cursor.fetchone()[0]
    conn.commit()
    cursor.close()
    
    return download_id


def format_file_size(size_bytes: int) -> str:
    """Форматирование размера файла"""
    if not size_bytes:
        return 'N/A'
    
    if size_bytes < 1024:
        return f"{size_bytes} Б"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} КБ"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} МБ"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} ГБ"


def cors_response():
    """CORS ответ"""
    return {
        'statusCode': 200,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        },
        'body': ''
    }


def success_response(data: dict):
    """Успешный ответ"""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(data, ensure_ascii=False)
    }


def error_response(message: str, status_code: int = 400):
    """Ответ с ошибкой"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'error': message}, ensure_ascii=False)
    }