// backend.js - Backend integration for NAS and OneDrive

class BackendManager {
    constructor() {
        this.providers = {
            nas: new NASProvider(),
            onedrive: new OneDriveProvider(),
            local: new LocalProvider()
        };
        
        this.currentProvider = 'local';
        this.syncInterval = null;
        this.syncQueue = [];
        this.isOnline = navigator.onLine;
        
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.processSyncQueue();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }
    
    // Configure backend
    async configure(provider, config) {
        this.currentProvider = provider;
        
        if (provider === 'nas') {
            await this.providers.nas.configure(config);
        } else if (provider === 'onedrive') {
            await this.providers.onedrive.configure(config);
        }
        
        // Start auto-sync
        this.startAutoSync();
    }
    
    // Get current provider
    getProvider() {
        return this.providers[this.currentProvider];
    }
    
    // Save data
    async save(key, data) {
        const provider = this.getProvider();
        
        try {
            if (this.isOnline || this.currentProvider === 'local') {
                await provider.save(key, data);
            } else {
                // Queue for later sync
                this.queueSync('save', key, data);
            }
        } catch (error) {
            console.error('Save failed:', error);
            // Fallback to local storage
            await this.providers.local.save(key, data);
            this.queueSync('save', key, data);
        }
    }
    
    // Load data
    async load(key) {
        const provider = this.getProvider();
        
        try {
            return await provider.load(key);
        } catch (error) {
            console.error('Load failed:', error);
            // Fallback to local storage
            return await this.providers.local.load(key);
        }
    }
    
    // Queue sync operation
    queueSync(operation, key, data) {
        this.syncQueue.push({
            operation,
            key,
            data,
            timestamp: Date.now()
        });
        
        // Register background sync
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            navigator.serviceWorker.ready.then(registration => {
                registration.sync.register('sync-data');
            });
        }
    }
    
    // Process sync queue
    async processSyncQueue() {
        if (!this.isOnline || this.currentProvider === 'local') return;
        
        const provider = this.getProvider();
        const queue = [...this.syncQueue];
        this.syncQueue = [];
        
        for (const item of queue) {
            try {
                if (item.operation === 'save') {
                    await provider.save(item.key, item.data);
                }
            } catch (error) {
                console.error('Sync failed:', error);
                // Re-queue if failed
                this.syncQueue.push(item);
            }
        }
    }
    
    // Start auto sync
    startAutoSync(interval = 300000) { // 5 minutes
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        this.syncInterval = setInterval(() => {
            this.sync();
        }, interval);
        
        // Initial sync
        this.sync();
    }
    
    // Manual sync
    async sync() {
        if (!this.isOnline || this.currentProvider === 'local') return;
        
        try {
            await this.processSyncQueue();
            await this.syncData();
            return { success: true };
        } catch (error) {
            console.error('Sync error:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Sync all data
    async syncData() {
        const provider = this.getProvider();
        const keys = ['templates', 'exercises', 'workoutHistory', 'settings'];
        
        for (const key of keys) {
            try {
                // Get local data
                const localData = await this.providers.local.load(key);
                
                // Get remote data
                const remoteData = await provider.load(key);
                
                // Merge data (simple last-write-wins for now)
                if (localData && remoteData) {
                    const merged = this.mergeData(localData, remoteData);
                    await provider.save(key, merged);
                    await this.providers.local.save(key, merged);
                } else if (localData) {
                    await provider.save(key, localData);
                } else if (remoteData) {
                    await this.providers.local.save(key, remoteData);
                }
            } catch (error) {
                console.error(`Sync ${key} failed:`, error);
            }
        }
    }
    
    // Simple merge strategy (can be improved)
    mergeData(local, remote) {
        // For now, just use the most recent data
        // In a real app, you'd want more sophisticated merging
        return local;
    }
}

// NAS Provider
class NASProvider {
    constructor() {
        this.baseUrl = '';
        this.username = '';
        this.password = '';
        this.token = null;
    }
    
    async configure(config) {
        this.baseUrl = config.url;
        this.username = config.username;
        this.password = config.password;
        
        // Authenticate
        await this.authenticate();
    }
    
    async authenticate() {
        try {
            const response = await fetch(`${this.baseUrl}/webapi/auth.cgi`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    api: 'SYNO.API.Auth',
                    version: '3',
                    method: 'login',
                    account: this.username,
                    passwd: this.password,
                    session: 'GymTracker',
                    format: 'sid'
                })
            });
            
            const data = await response.json();
            if (data.success) {
                this.token = data.data.sid;
            } else {
                throw new Error('NAS authentication failed');
            }
        } catch (error) {
            console.error('NAS auth error:', error);
            throw error;
        }
    }
    
    async save(key, data) {
        const filePath = `/GymTracker/${key}.json`;
        
        try {
            // Create folder if not exists
            await this.createFolder('/GymTracker');
            
            // Upload file
            const formData = new FormData();
            formData.append('api', 'SYNO.FileStation.Upload');
            formData.append('version', '2');
            formData.append('method', 'upload');
            formData.append('path', '/home/GymTracker');
            formData.append('create_parents', 'true');
            formData.append('overwrite', 'true');
            formData.append('_sid', this.token);
            
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            formData.append('file', blob, `${key}.json`);
            
            const response = await fetch(`${this.baseUrl}/webapi/entry.cgi`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            if (!result.success) {
                throw new Error('Failed to save to NAS');
            }
        } catch (error) {
            console.error('NAS save error:', error);
            throw error;
        }
    }
    
    async load(key) {
        const filePath = `/home/GymTracker/${key}.json`;
        
        try {
            const response = await fetch(`${this.baseUrl}/webapi/entry.cgi`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    api: 'SYNO.FileStation.Download',
                    version: '2',
                    method: 'download',
                    path: filePath,
                    mode: 'open',
                    _sid: this.token
                })
            });
            
            if (response.ok) {
                return await response.json();
            } else {
                throw new Error('Failed to load from NAS');
            }
        } catch (error) {
            console.error('NAS load error:', error);
            throw error;
        }
    }
    
    async createFolder(path) {
        try {
            await fetch(`${this.baseUrl}/webapi/entry.cgi`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    api: 'SYNO.FileStation.CreateFolder',
                    version: '2',
                    method: 'create',
                    folder_path: '/home',
                    name: 'GymTracker',
                    _sid: this.token
                })
            });
        } catch (error) {
            // Folder might already exist
            console.log('Create folder error (might already exist):', error);
        }
    }
}

// OneDrive Provider
class OneDriveProvider {
    constructor() {
        this.accessToken = null;
        this.refreshToken = null;
        this.clientId = 'YOUR_CLIENT_ID'; // Replace with your app's client ID
        this.redirectUri = window.location.origin + '/auth/callback';
        this.scope = 'files.readwrite offline_access';
    }
    
    async configure(config) {
        if (config.accessToken) {
            this.accessToken = config.accessToken;
            this.refreshToken = config.refreshToken;
        } else {
            await this.authenticate();
        }
    }
    
    async authenticate() {
        // OAuth2 flow
        const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
            `client_id=${this.clientId}` +
            `&response_type=code` +
            `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
            `&scope=${encodeURIComponent(this.scope)}` +
            `&response_mode=query`;
        
        // Open auth window
        const authWindow = window.open(authUrl, 'OneDrive Auth', 'width=500,height=600');
        
        // Wait for callback
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                try {
                    if (authWindow.closed) {
                        clearInterval(checkInterval);
                        
                        // Check if we got the token
                        const token = localStorage.getItem('onedrive_token');
                        if (token) {
                            this.accessToken = token;
                            resolve();
                        } else {
                            reject(new Error('Authentication cancelled'));
                        }
                    }
                } catch (error) {
                    // Cross-origin error, ignore
                }
            }, 1000);
        });
    }
    
    async refreshAccessToken() {
        try {
            const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    scope: this.scope,
                    refresh_token: this.refreshToken,
                    grant_type: 'refresh_token'
                })
            });
            
            const data = await response.json();
            this.accessToken = data.access_token;
            this.refreshToken = data.refresh_token;
            
            // Save tokens
            localStorage.setItem('onedrive_token', this.accessToken);
            localStorage.setItem('onedrive_refresh', this.refreshToken);
        } catch (error) {
            console.error('Token refresh failed:', error);
            throw error;
        }
    }
    
    async save(key, data) {
        const filePath = `/drive/root:/GymTracker/${key}.json:/content`;
        
        try {
            const response = await fetch(`https://graph.microsoft.com/v1.0${filePath}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (response.status === 401) {
                // Token expired, refresh and retry
                await this.refreshAccessToken();
                return this.save(key, data);
            }
            
            if (!response.ok) {
                throw new Error('Failed to save to OneDrive');
            }
            
            return await response.json();
        } catch (error) {
            console.error('OneDrive save error:', error);
            throw error;
        }
    }
    
    async load(key) {
        const filePath = `/drive/root:/GymTracker/${key}.json:/content`;
        
        try {
            const response = await fetch(`https://graph.microsoft.com/v1.0${filePath}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });
            
            if (response.status === 401) {
                // Token expired, refresh and retry
                await this.refreshAccessToken();
                return this.load(key);
            }
            
            if (response.status === 404) {
                // File doesn't exist
                return null;
            }
            
            if (!response.ok) {
                throw new Error('Failed to load from OneDrive');
            }
            
            return await response.json();
        } catch (error) {
            console.error('OneDrive load error:', error);
            throw error;
        }
    }
}

// Local Provider (fallback)
class LocalProvider {
    async save(key, data) {
        try {
            localStorage.setItem(`gymTracker_${key}`, JSON.stringify(data));
        } catch (error) {
            console.error('Local save error:', error);
            throw error;
        }
    }
    
    async load(key) {
        try {
            const data = localStorage.getItem(`gymTracker_${key}`);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Local load error:', error);
            throw error;
        }
    }
}

// Export for use in main app
window.BackendManager = BackendManager;