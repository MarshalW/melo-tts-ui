import { useState, useRef, useEffect } from 'react';
import '@ant-design/v5-patch-for-react-19';
import {
    Button, Input, Card, Row, Col, Space, Alert, Progress,
    Typography, Form, Select, Popconfirm, Modal, List
} from 'antd';
import {
    AudioOutlined, PlayCircleOutlined, PauseCircleOutlined,
    DownloadOutlined, SettingOutlined, PlusOutlined,
    DeleteOutlined, EditOutlined
} from '@ant-design/icons';

const { TextArea } = Input;
const { Title, Text } = Typography;
const { Item } = Form;
const { Option } = Select;

interface ApiConfig {
    id: string;
    title: string;
    url: string;
}

// 定义存储在localStorage中的数据结构
interface TtsSettings {
    apiConfigs: ApiConfig[];
    selectedApiId: string;
}

const TTSConverter = () => {
    const [text, setText] = useState<string>('');
    const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
    const [selectedApiId, setSelectedApiId] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [urlError, setUrlError] = useState<string>('');
    const [showSettings, setShowSettings] = useState<boolean>(false);
    const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
    const [currentConfig, setCurrentConfig] = useState<ApiConfig | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    
    // 从localStorage加载设置
    useEffect(() => {
        const savedSettings = localStorage.getItem('ttsSettings');
        if (savedSettings) {
            try {
                const settings: TtsSettings = JSON.parse(savedSettings);
                setApiConfigs(settings.apiConfigs);
                setSelectedApiId(settings.selectedApiId);
            } catch (e) {
                console.error('Failed to parse saved settings', e);
                initializeDefaultSettings();
            }
        } else {
            initializeDefaultSettings();
        }
    }, []);

    // 保存设置到localStorage
    useEffect(() => {
        if (apiConfigs.length > 0 && selectedApiId) {
            const settings: TtsSettings = {
                apiConfigs,
                selectedApiId
            };
            localStorage.setItem('ttsSettings', JSON.stringify(settings));
        }
    }, [apiConfigs, selectedApiId]);

    // 初始化默认设置
    const initializeDefaultSettings = () => {
        const defaultConfig: ApiConfig = {
            id: 'default',
            title: '默认配置',
            url: import.meta.env.DEV
                ? '/convert/tts'
                : import.meta.env.VITE_TTS_SERVER || '/convert/tts'
        };
        
        setApiConfigs([defaultConfig]);
        setSelectedApiId('default');
    };

    // 获取当前选中的 API 配置
    const selectedConfig = apiConfigs.find(config => config.id === selectedApiId) || apiConfigs[0];

    // URL 验证函数
    const validateUrl = (url: string): boolean => {
        try {
            const urlPattern = /^(?:(?:https?|ftp):\/\/[^\s/$.?#][^\s]*|\/[\w\-./]*[^\s]*)$/i;

            if (!urlPattern.test(url)) {
                setUrlError('URL格式不正确，请使用http:///https://开头或/开头的相对路径');
                return false;
            }

            if (url.startsWith('/') && url.includes('//')) {
                setUrlError('相对路径不能包含连续斜杠(//)');
                return false;
            }

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

        // 验证当前选中的 API URL
        if (!selectedConfig || !validateUrl(selectedConfig.url)) {
            return;
        }

        try {
            setIsLoading(true);
            setProgress(10);
            setError(null);

            const progressInterval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return prev;
                    }
                    return prev + 10;
                });
            }, 300);

            // 使用当前选中的 API 配置
            const response = await fetch(selectedConfig.url, {
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

            setTimeout(() => {
                if (audioRef.current) {
                    audioRef.current.play();
                    setIsPlaying(true);
                }
            }, 300);

        } catch (err) {
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

    // 打开配置模态框（用于添加或编辑）
    const openConfigModal = (config: ApiConfig | null = null) => {
        setCurrentConfig(config);
        setShowConfigModal(true);
        setUrlError('');
    };

    // 保存配置（添加或更新）
    const handleSaveConfig = () => {
        if (!currentConfig || !currentConfig.title.trim() || !currentConfig.url.trim()) {
            setUrlError('配置名称和URL不能为空');
            return;
        }

        if (!validateUrl(currentConfig.url)) {
            return;
        }

        // 更新现有配置
        if (currentConfig.id && currentConfig.id !== 'new') {
            setApiConfigs(apiConfigs.map(config =>
                config.id === currentConfig.id ? currentConfig : config
            ));
        }
        // 添加新配置
        else {
            const newId = `config-${Date.now()}`;
            const newConfig = {
                ...currentConfig,
                id: newId
            };
            setApiConfigs([...apiConfigs, newConfig]);
            setSelectedApiId(newId); // 自动选中新配置
        }

        setShowConfigModal(false);
        setCurrentConfig(null);
    };

    // 删除 API 配置
    const handleDeleteConfig = (id: string) => {
        if (apiConfigs.length <= 1) {
            setUrlError('至少需要保留一个配置');
            return;
        }

        const newConfigs = apiConfigs.filter(config => config.id !== id);
        setApiConfigs(newConfigs);

        // 如果删除的是当前选中的配置，则切换到第一个配置
        if (id === selectedApiId) {
            setSelectedApiId(newConfigs[0].id);
        }
    };

    // 处理配置选择变化
    const handleConfigChange = (value: string) => {
        setSelectedApiId(value);
    };

    // Card头部样式对象
    const cardHeaderStyle = {
        backgroundColor: '#f0f5ff',
        borderBottom: '1px solid #e8e8e8'
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
                    title="API配置管理"
                    variant="borderless"
                    style={{ marginBottom: 24 }}
                    styles={{ header: cardHeaderStyle }}
                    extra={
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => openConfigModal({
                                id: 'new',
                                title: '',
                                url: ''
                            })}
                        >
                            添加配置
                        </Button>
                    }
                >
                    <Form layout="vertical">
                        <Item
                            label="当前使用的API配置"
                            style={{ marginBottom: 24 }}
                        >
                            <Select
                                value={selectedApiId}
                                onChange={handleConfigChange}
                                style={{ width: '100%' }}
                            >
                                {apiConfigs.map(config => (
                                    <Option key={config.id} value={config.id}>
                                        {config.title} ({config.url})
                                    </Option>
                                ))}
                            </Select>
                        </Item>

                        <Item label="现有配置列表">
                            <List
                                itemLayout="horizontal"
                                dataSource={apiConfigs}
                                renderItem={(config) => (
                                    <List.Item
                                        actions={[
                                            <Button
                                                type="text"
                                                icon={<EditOutlined />}
                                                onClick={() => openConfigModal(config)}
                                            />,
                                            <Popconfirm
                                                title="确定要删除此配置吗？"
                                                onConfirm={() => handleDeleteConfig(config.id)}
                                                okText="确定"
                                                cancelText="取消"
                                                disabled={config.id === 'default'}
                                            >
                                                <Button
                                                    type="text"
                                                    icon={<DeleteOutlined />}
                                                    danger
                                                    disabled={config.id === 'default'}
                                                />
                                            </Popconfirm>
                                        ]}
                                    >
                                        <List.Item.Meta
                                            title={config.title}
                                            description={config.url}
                                        />
                                    </List.Item>
                                )}
                            />
                        </Item>
                    </Form>
                </Card>
            )}

            {/* 配置编辑/添加模态框 */}
            <Modal
                title={currentConfig?.id === 'new' ? '添加新API配置' : '编辑API配置'}
                open={showConfigModal}
                onOk={handleSaveConfig}
                onCancel={() => {
                    setShowConfigModal(false);
                    setCurrentConfig(null);
                    setUrlError('');
                }}
                okText={currentConfig?.id === 'new' ? '添加' : '保存'}
                cancelText="取消"
            >
                <Form layout="vertical">
                    <Item
                        label="配置名称"
                        required
                    >
                        <Input
                            value={currentConfig?.title || ''}
                            onChange={(e) => setCurrentConfig({
                                ...currentConfig!,
                                title: e.target.value
                            })}
                            placeholder="请输入配置名称"
                        />
                    </Item>
                    <Item
                        label="API URL"
                        required
                        validateStatus={urlError ? 'error' : ''}
                        help={urlError || '请输入有效的API端点URL'}
                    >
                        <Input
                            value={currentConfig?.url || ''}
                            onChange={(e) => setCurrentConfig({
                                ...currentConfig!,
                                url: e.target.value
                            })}
                            placeholder="例如: http://localhost:7777/convert/tts"
                            onBlur={() => currentConfig?.url && validateUrl(currentConfig.url)}
                        />
                    </Item>
                </Form>
            </Modal>

            <Card
                title={`输入文本`}
                variant="borderless"
                styles={{ header: cardHeaderStyle }}
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
                        {isLoading ? `转换中@${selectedConfig?.title || ''}...` : `转换为语音@${selectedConfig?.title || ''}`}
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
                    variant="borderless"
                    style={{ marginTop: 24 }}
                    styles={{ header: cardHeaderStyle }}
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