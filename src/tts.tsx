import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Button, Input, Card, Row, Col, Space, Alert, Progress, Typography, Form } from 'antd';
import { AudioOutlined, PlayCircleOutlined, PauseCircleOutlined, DownloadOutlined, SettingOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Title, Text } = Typography;
const { Item } = Form;

const TTSConverter = () => {
    const [text, setText] = useState<string>('');
    // 动态设置API URL，根据环境变量自动切换
    const [apiUrl, setApiUrl] = useState<string>(
        import.meta.env.DEV
            ? '/convert/tts'
            : import.meta.env.VITE_TTS_SERVER || '/convert/tts'
    );
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [urlError, setUrlError] = useState<string>('');
    const [showSettings, setShowSettings] = useState<boolean>(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);

    // 修改后的URL验证函数（支持相对路径）
    const validateUrl = (url: string): boolean => {
        try {
            // 扩展正则表达式：允许相对路径（以/开头）和绝对URL
            const urlPattern = /^(?:(?:https?|ftp):\/\/[^\s/$.?#][^\s]*|\/[\w\-./]*[^\s]*)$/i;

            if (!urlPattern.test(url)) {
                setUrlError('URL格式不正确，请使用http:///https://开头或/开头的相对路径');
                return false;
            }

            // 处理相对路径（无需完整URL验证）
            if (url.startsWith('/')) {
                // 可选：检查相对路径的格式（如不允许连续斜杠）
                if (url.includes('//')) {
                    setUrlError('相对路径不能包含连续斜杠(//)');
                    return false;
                }
                setUrlError('');
                return true;
            }

            // 绝对URL使用原生URL对象验证
            new URL(url);
            setUrlError('');
            return true;
        } catch (e) {
            setUrlError(url.startsWith('/')
                ? '无效的相对路径'
                : '无效的绝对URL，请检查格式');
            return false;
        }
    };

    const handleConvert = async () => {
        if (!text.trim()) {
            setError('请输入要转换的文本');
            return;
        }

        // 验证API URL
        if (!validateUrl(apiUrl)) {
            return;
        }

        try {
            setIsLoading(true);
            setProgress(10);
            setError(null);

            // 模拟转换过程
            const progressInterval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return prev;
                    }
                    return prev + 10;
                });
            }, 300);

            // 发送请求到 TTS API
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text }),
            });

            clearInterval(progressInterval);
            setProgress(100);

            if (!response.ok) {
                throw new Error(`转换失败: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);

            // 自动播放
            setTimeout(() => {
                if (audioRef.current) {
                    audioRef.current.play();
                    setIsPlaying(true);
                }
            }, 300);

        } catch (err) {
            // 安全处理unknown类型的错误
            const errorMessage = err instanceof Error ? err.message : '发生未知错误';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
            setTimeout(() => setProgress(0), 1000);
        }
    };

    const togglePlay = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleDownload = () => {
        if (!audioUrl) return;

        const link = document.createElement('a');
        link.href = audioUrl;
        link.download = 'tts-output.wav';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 添加事件参数类型
    const handleUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
        const newUrl = e.target.value;
        setApiUrl(newUrl);
        validateUrl(newUrl);
    };

    return (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
            <Title level={3} style={{ textAlign: 'center', marginBottom: 30 }}>
                <AudioOutlined /> 文本转语音转换器
            </Title>

            <div style={{ marginBottom: 20, textAlign: 'right' }}>
                <Button
                    type="link"
                    icon={<SettingOutlined />}
                    onClick={() => setShowSettings(!showSettings)}
                >
                    {showSettings ? '隐藏设置' : 'API设置'}
                </Button>
            </div>

            {showSettings && (
                <Card
                    title="API设置"
                    bordered={false}
                    style={{ marginBottom: 24 }}
                    headStyle={{ backgroundColor: '#f0f5ff', borderBottom: '1px solid #e8e8e8' }}
                >
                    <Form layout="vertical">
                        <Item
                            label="TTS转换接口URL"
                            validateStatus={urlError ? 'error' : ''}
                            help={urlError || '请输入有效的API端点URL'}
                        >
                            <Input
                                value={apiUrl}
                                onChange={handleUrlChange}
                                placeholder="例如: http://localhost:7777/convert/tts"
                                onBlur={() => validateUrl(apiUrl)}
                            />
                        </Item>
                        <Text type="secondary">
                            提示: 确保URL格式正确并以http://或https://开头
                        </Text>
                    </Form>
                </Card>
            )}

            <Card
                title="输入文本"
                bordered={false}
                headStyle={{ backgroundColor: '#f0f5ff', borderBottom: '1px solid #e8e8e8' }}
            >
                <TextArea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="请输入要转换为语音的文本..."
                    autoSize={{ minRows: 4, maxRows: 8 }}
                    style={{ marginBottom: 16 }}
                />

                <Row justify="center">
                    <Button
                        type="primary"
                        onClick={handleConvert}
                        icon={<AudioOutlined />}
                        loading={isLoading}
                        size="large"
                        style={{ width: 200, height: 46 }}
                    >
                        {isLoading ? '转换中...' : '转换为语音'}
                    </Button>
                </Row>
            </Card>

            {isLoading && (
                <Card style={{ marginTop: 24 }}>
                    <Progress
                        percent={progress}
                        status={progress < 100 ? "active" : "success"}
                        strokeColor={{ from: '#108ee9', to: '#87d068' }}
                    />
                    <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
                        正在生成语音文件...
                    </Text>
                </Card>
            )}

            {error && (
                <Alert
                    message="错误"
                    description={error}
                    type="error"
                    showIcon
                    style={{ marginTop: 24 }}
                />
            )}

            {audioUrl && !isLoading && (
                <Card
                    title="语音输出"
                    bordered={false}
                    style={{ marginTop: 24 }}
                    headStyle={{ backgroundColor: '#f0f5ff', borderBottom: '1px solid #e8e8e8' }}
                >
                    <Row align="middle" gutter={16}>
                        <Col flex="auto">
                            <audio
                                ref={audioRef}
                                src={audioUrl}
                                controls
                                style={{ width: '100%' }}
                                onEnded={() => setIsPlaying(false)}
                            />
                        </Col>
                        <Col>
                            <Space>
                                <Button
                                    type={isPlaying ? 'default' : 'primary'}
                                    icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                                    onClick={togglePlay}
                                >
                                    {isPlaying ? '暂停' : '播放'}
                                </Button>
                                <Button
                                    type="dashed"
                                    icon={<DownloadOutlined />}
                                    onClick={handleDownload}
                                >
                                    下载音频
                                </Button>
                            </Space>
                        </Col>
                    </Row>
                </Card>
            )}

            <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Text type="secondary">
                    使用说明：输入文本后点击"转换为语音"按钮，系统将生成对应的音频文件
                </Text>
            </div>
        </div>
    );
};

export default TTSConverter;