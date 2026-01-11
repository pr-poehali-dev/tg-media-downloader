import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface DownloadItem {
  id: string;
  url: string;
  type: 'video' | 'photo';
  title: string;
  date: string;
  thumbnail: string;
  size: string;
  cached: boolean;
}

interface StatsData {
  totalDownloads: number;
  cachedFiles: number;
  savedSpace: string;
  activeUsers: number;
}

const API_URL = 'https://functions.poehali.dev/d811f6bc-037a-4fbb-907a-d8d81a993ed5';

const Index = () => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<DownloadItem[]>([]);
  const [stats, setStats] = useState<StatsData>({
    totalDownloads: 0,
    cachedFiles: 0,
    savedSpace: '0 Б',
    activeUsers: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await fetch(API_URL);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
        setStats(data.stats || stats);
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    }
  };

  const handleDownload = async () => {
    if (!url.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите ссылку на материал',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: data.cached ? '⚡ Из кэша!' : '✅ Готово!',
          description: data.cached 
            ? 'Материал загружен мгновенно из кэша'
            : 'Материал загружен и доступен для скачивания'
        });
        setUrl('');
        loadData();
      } else {
        toast({
          title: 'Ошибка',
          description: data.error || 'Не удалось загрузить материал',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка сети',
        description: 'Проверьте подключение к интернету',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in">
        <header className="text-center space-y-4 py-8">
          <div className="flex items-center justify-center gap-3">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
              <Icon name="Download" size={32} className="text-primary-foreground" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
              TG Media Bot
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Скачивайте видео и фото из закрытых Telegram каналов
          </p>
        </header>

        <Tabs defaultValue="home" className="space-y-8">
          <TabsList className="grid w-full grid-cols-5 max-w-3xl mx-auto h-14">
            <TabsTrigger value="home" className="gap-2">
              <Icon name="Home" size={18} />
              <span className="hidden sm:inline">Главная</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <Icon name="History" size={18} />
              <span className="hidden sm:inline">История</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2">
              <Icon name="BarChart3" size={18} />
              <span className="hidden sm:inline">Статистика</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Icon name="Settings" size={18} />
              <span className="hidden sm:inline">Настройки</span>
            </TabsTrigger>
            <TabsTrigger value="help" className="gap-2">
              <Icon name="HelpCircle" size={18} />
              <span className="hidden sm:inline">Помощь</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="home" className="space-y-6 animate-slide-up">
            <Card className="border-2 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon name="Link" size={24} />
                  Загрузить материал
                </CardTitle>
                <CardDescription>
                  Вставьте ссылку на видео или фото из Telegram канала
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://t.me/channel/123"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="h-12 text-base"
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleDownload}
                    disabled={isLoading}
                    size="lg"
                    className="px-8 gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Icon name="Loader2" size={20} className="animate-spin" />
                        Загрузка...
                      </>
                    ) : (
                      <>
                        <Icon name="Download" size={20} />
                        Скачать
                      </>
                    )}
                  </Button>
                </div>
                {isLoading && (
                  <div className="space-y-2">
                    <Progress value={66} className="h-2" />
                    <p className="text-sm text-muted-foreground text-center">
                      Обработка материала...
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon name="Video" size={20} />
                    Видео форматы
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">MP4, AVI, MKV</span>
                      <Badge variant="secondary">Поддерживается</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">До 2 ГБ</span>
                      <Badge>Без ограничений</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon name="Image" size={20} />
                    Фото форматы
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">JPG, PNG, WEBP</span>
                      <Badge variant="secondary">Поддерживается</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Любое качество</span>
                      <Badge>HD Ready</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-6 animate-slide-up">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon name="Clock" size={24} />
                  История загрузок
                </CardTitle>
                <CardDescription>
                  Все ваши недавние скачивания и кэшированные файлы
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {history.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Icon name="Inbox" size={48} className="mx-auto mb-4 opacity-50" />
                    <p>История загрузок пуста</p>
                    <p className="text-sm mt-2">Скачайте первый файл, чтобы увидеть его здесь</p>
                  </div>
                ) : history.map((item) => (
                  <Card key={item.id} className="border hover:border-primary/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <div className="relative">
                          <img
                            src={item.thumbnail}
                            alt={item.title}
                            className="w-24 h-24 object-cover rounded-lg"
                          />
                          {item.cached && (
                            <Badge className="absolute -top-2 -right-2 gap-1">
                              <Icon name="Zap" size={12} />
                              Кэш
                            </Badge>
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold">{item.title}</h4>
                              <p className="text-sm text-muted-foreground">{item.date}</p>
                            </div>
                            <Badge variant="outline">
                              <Icon name={item.type === 'video' ? 'Video' : 'Image'} size={14} className="mr-1" />
                              {item.type === 'video' ? 'Видео' : 'Фото'}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">{item.size}</span>
                            <Button size="sm" variant="outline" className="gap-2">
                              <Icon name="Download" size={16} />
                              Скачать снова
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-6 animate-slide-up">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-2 shadow-lg">
                <CardContent className="p-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <Icon name="Download" size={24} className="text-primary" />
                    <Icon name="TrendingUp" size={20} className="text-green-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{stats.totalDownloads}</p>
                    <p className="text-sm text-muted-foreground">Всего загрузок</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 shadow-lg">
                <CardContent className="p-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <Icon name="Zap" size={24} className="text-yellow-500" />
                    <Icon name="TrendingUp" size={20} className="text-green-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{stats.cachedFiles}</p>
                    <p className="text-sm text-muted-foreground">Кэшированных файлов</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 shadow-lg">
                <CardContent className="p-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <Icon name="HardDrive" size={24} className="text-blue-500" />
                    <Icon name="TrendingDown" size={20} className="text-green-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{stats.savedSpace}</p>
                    <p className="text-sm text-muted-foreground">Сэкономлено места</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 shadow-lg">
                <CardContent className="p-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <Icon name="Users" size={24} className="text-purple-500" />
                    <Icon name="TrendingUp" size={20} className="text-green-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{stats.activeUsers}</p>
                    <p className="text-sm text-muted-foreground">Активных пользователей</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>График активности</CardTitle>
                <CardDescription>Загрузки за последние 7 дней</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, index) => (
                    <div key={day} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{day}</span>
                        <span className="text-muted-foreground">{Math.floor(Math.random() * 100 + 50)} файлов</span>
                      </div>
                      <Progress value={Math.random() * 100} className="h-3" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6 animate-slide-up">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon name="Settings" size={24} />
                  Настройки бота
                </CardTitle>
                <CardDescription>
                  Настройте параметры работы бота под себя
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">Автоматическое кэширование</p>
                      <p className="text-sm text-muted-foreground">
                        Сохранять популярные файлы для быстрого доступа
                      </p>
                    </div>
                    <Button variant="outline">
                      <Icon name="ToggleRight" size={20} className="text-primary" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">Уведомления</p>
                      <p className="text-sm text-muted-foreground">
                        Получать оповещения о завершении загрузки
                      </p>
                    </div>
                    <Button variant="outline">
                      <Icon name="ToggleRight" size={20} className="text-primary" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">Качество видео</p>
                      <p className="text-sm text-muted-foreground">
                        Выберите предпочитаемое качество
                      </p>
                    </div>
                    <Badge>Максимальное</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon name="Bot" size={24} />
                  Telegram Bot
                </CardTitle>
                <CardDescription>
                  Подключите бота в Telegram мессенджере
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Webhook URL:</p>
                  <div className="flex gap-2">
                    <Input 
                      value="https://functions.poehali.dev/d5516f0e-2c7a-4b63-bc40-104c9246c918"
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText('https://functions.poehali.dev/d5516f0e-2c7a-4b63-bc40-104c9246c918');
                        toast({ title: 'Скопировано!', description: 'URL скопирован в буфер обмена' });
                      }}
                    >
                      <Icon name="Copy" size={16} />
                    </Button>
                  </div>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                  <p className="font-medium">📱 Как настроить:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Скопируй Webhook URL выше</li>
                    <li>Открой: https://functions.poehali.dev/d5516f0e-2c7a-4b63-bc40-104c9246c918?action=set_webhook&url=WEBHOOK_URL</li>
                    <li>Замени WEBHOOK_URL на скопированный адрес</li>
                    <li>Найди своего бота в Telegram и отправь /start</li>
                  </ol>
                </div>
                <div className="bg-primary/10 p-4 rounded-lg">
                  <p className="text-sm font-medium mb-2">✨ Команды бота:</p>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p><code className="bg-background px-2 py-0.5 rounded">/start</code> - начать работу</p>
                    <p><code className="bg-background px-2 py-0.5 rounded">/help</code> - справка</p>
                    <p><code className="bg-background px-2 py-0.5 rounded">/stats</code> - статистика</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="help" className="space-y-6 animate-slide-up">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon name="HelpCircle" size={24} />
                  Помощь и поддержка
                </CardTitle>
                <CardDescription>
                  Ответы на часто задаваемые вопросы
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <Card className="border">
                    <CardHeader>
                      <CardTitle className="text-lg">Как использовать бота?</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <p className="font-medium text-sm mb-2">💻 Веб-интерфейс:</p>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                            <li>Скопируй ссылку на медиа из Telegram</li>
                            <li>Вставь в поле на главной странице</li>
                            <li>Нажми "Скачать"</li>
                          </ol>
                        </div>
                        <div>
                          <p className="font-medium text-sm mb-2">📱 Telegram мессенджер:</p>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                            <li>Настрой webhook (см. раздел Настройки)</li>
                            <li>Найди бота в Telegram</li>
                            <li>Отправь /start</li>
                            <li>Отправь ссылку на медиа</li>
                          </ol>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border">
                    <CardHeader>
                      <CardTitle className="text-lg">Какие форматы поддерживаются?</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">
                        Бот поддерживает все популярные форматы: MP4, AVI, MKV для видео и JPG, PNG, WEBP для фото.
                        Максимальный размер файла - 2 ГБ.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border">
                    <CardHeader>
                      <CardTitle className="text-lg">Что такое кэширование?</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">
                        Популярные файлы сохраняются на сервере для мгновенного доступа. Это ускоряет
                        повторные загрузки и экономит трафик.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-2 border-primary/20 bg-primary/5">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Icon name="MessageCircle" size={24} className="text-primary" />
                      <div className="space-y-2">
                        <p className="font-semibold">Нужна дополнительная помощь?</p>
                        <p className="text-sm text-muted-foreground">
                          Свяжитесь с нашей службой поддержки в Telegram
                        </p>
                        <Button variant="outline" className="gap-2">
                          <Icon name="Send" size={16} />
                          Написать в поддержку
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <footer className="text-center py-8 text-muted-foreground text-sm">
          <p>© 2026 TG Media Bot. Все права защищены.</p>
          <p className="mt-2">Создано с ❤️ для удобного доступа к контенту</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;