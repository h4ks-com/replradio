# H4KS Radio REPL

🎵 Live code music with Strudel - A 90s-inspired web-based music coding environment with cloud storage and audio recording.

## Features

- **Strudel REPL**: Full-featured live coding environment for music creation
- **Code Sharing**: Share your patterns via short URLs (auto-expires in 24 hours)
- **Audio Recording**: Record your patterns as WAV files
- **90s Terminal Aesthetic**: Dark green CRT-style interface with scanlines
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Automated Recording**: URL parameters for headless audio rendering (Puppeteer/Browserless)

## Quick Start

### Using Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd replradio
   ```

2. **Build and run with Docker Compose**
   ```bash
   docker compose up -d
   ```

3. **Access the application**
   ```
   http://localhost:8080
   ```

### Development Setup

1. **Serve static files** (any HTTP server)
   ```bash
   # Python
   python3 -m http.server 8080 -d public

   # Node.js (http-server)
   npx http-server public -p 8080

   # PHP
   php -S localhost:8080 -t public
   ```

2. **Open in browser**
   ```
   http://localhost:8080
   ```

## MinIO S3 Setup

The application requires a MinIO S3 bucket for code sharing and storage.

### Prerequisites

- MinIO server (self-hosted or cloud)
- MinIO Client (`mc`) installed
- Access credentials (ACCESS_KEY and SECRET_KEY)

### Automated Setup

Run the provided setup script:

```bash
chmod +x setup-minio.sh
./setup-minio.sh
```

The script will:
- Create bucket: `replradio-uploads`
- Set 3GB hard quota
- Configure 1-day expiration lifecycle
- Enable anonymous uploads (write-only)
- Verify configuration

### Manual Setup

1. **Install MinIO Client**
   ```bash
   wget https://dl.min.io/client/mc/release/linux-amd64/mc
   chmod +x mc
   sudo mv mc /usr/local/bin/
   ```

2. **Configure alias**
   ```bash
   mc alias set h4ks-s3 https://s3-api.t3ks.com ACCESS_KEY SECRET_KEY
   ```

3. **Create bucket**
   ```bash
   mc mb h4ks-s3/replradio-uploads
   mc versioning disable h4ks-s3/replradio-uploads
   ```

4. **Set quota (3GB)**
   ```bash
   mc admin bucket quota h4ks-s3/replradio-uploads --hard 3GB
   ```

5. **Configure lifecycle (1-day expiration)**
   ```bash
   mc ilm add h4ks-s3/replradio-uploads --expire-days "1"
   ```

6. **Enable anonymous uploads**
   ```bash
   mc anonymous set upload h4ks-s3/replradio-uploads
   ```

7. **Verify setup**
   ```bash
   mc stat h4ks-s3/replradio-uploads
   mc admin bucket quota h4ks-s3/replradio-uploads
   mc ilm ls h4ks-s3/replradio-uploads
   ```

### Storage Configuration

The application is configured for:

- **Endpoint**: `https://s3-api.t3ks.com`
- **Bucket**: `replradio-uploads`
- **Max file size**: 1MB (enforced client-side)
- **Max bucket size**: 3GB (enforced server-side)
- **Expiration**: 24 hours (auto-deletion)

To change the endpoint or bucket name, edit `/public/js/storage-client.js`:

```javascript
const MINIO_ENDPOINT = 'https://your-minio-server.com';
const BUCKET_NAME = 'your-bucket-name';
```

## Usage

### Basic Workflow

1. **Write code** in the Strudel REPL editor
2. **Click PLAY** (or press `Ctrl+Enter`) to start playback
3. **Click STOP** to stop playback
4. **Click SHARE** to generate a shareable URL
5. **Click RECORD** to capture audio as WAV file

### Keyboard Shortcuts

- `Ctrl + Enter`: Play pattern
- `Ctrl + .`: Stop playback

### Code Sharing

When you click **SHARE**:
1. Code is uploaded to MinIO S3
2. Random 5-character code is generated (e.g., `xW9kL`)
3. URL is copied to clipboard: `https://repl.h4ks.com/xW9kL`
4. URL loads the shared code when visited
5. Code auto-deletes after 24 hours

### Audio Recording

The app supports two recording modes:

#### Manual Recording
1. Click **PLAY** to start pattern
2. Click **RECORD** to start capturing audio
3. Click **STOP REC** to finish recording
4. WAV file downloads automatically
5. Optionally upload to MinIO (expires in 24h)

#### Automated Recording (Puppeteer/Browserless)

Use URL parameters for headless recording:

```
http://localhost:8080/?autoplay=true&maxlength=30&autorecord=true
```

**Parameters:**
- `autoplay=true`: Auto-start playback
- `maxlength=30`: Recording duration in seconds
- `autorecord=true`: Auto-start recording

**Puppeteer Example:**

```javascript
const puppeteer = require('puppeteer');

async function recordStrudel(code, duration = 30) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: './recordings'
    });

    await page.goto(
        `http://localhost:8080/${code}?autoplay=true&maxlength=${duration}&autorecord=true`
    );

    await page.waitForTimeout((duration + 5) * 1000);

    await browser.close();
}

recordStrudel('xW9kL', 30);
```

## Strudel Patterns

### Examples

**Simple melody:**
```javascript
note("c d e f g a b")
  .s("piano")
  .slow(2)
```

**Drum pattern:**
```javascript
s("bd sd hh sd")
  .bank("RolandTR909")
  .fast(2)
```

**Bassline:**
```javascript
note("c2 eb2 g2 bb2")
  .s("sawtooth")
  .lpf(800)
  .room(0.5)
```

**Melody with effects:**
```javascript
note("c a f e")
  .s("piano")
  .slow(2)
  .delay(0.5)
  .room(0.3)
```

### Resources

- [Strudel Documentation](https://strudel.cc/)
- [Strudel Tutorial](https://strudel.cc/learn)
- [Pattern Examples](https://strudel.cc/examples)
- [Sound Bank Reference](https://strudel.cc/sounds)

## Project Structure

```
replradio/
├── docker/
│   └── nginx.conf              # Nginx configuration
├── public/
│   ├── index.html              # Main HTML
│   ├── css/
│   │   └── style.css           # 90s terminal styling
│   ├── js/
│   │   ├── app.js              # Main coordinator
│   │   ├── strudel-controller.js  # Strudel integration
│   │   ├── audio-recorder.js   # Recording logic
│   │   └── storage-client.js   # MinIO upload/download
│   └── assets/
│       └── dj-icon.svg         # DJ icon
├── Dockerfile                  # Docker image
├── compose.yaml                # Docker Compose config
├── setup-minio.sh              # MinIO setup script
└── README.md                   # This file
```

## Technology Stack

### Frontend
- **Strudel**: `@strudel/repl` (CDN)
- **Audio**: Web Audio API, MediaRecorder API
- **WAV Encoding**: `audiobuffer-to-wav` (CDN)
- **Styling**: Vanilla CSS (90s terminal theme)

### Backend
- **Web Server**: nginx (Alpine Linux)
- **Storage**: MinIO S3 (self-hosted)

### Docker
- **Base Image**: `nginx:alpine`
- **Docker Compose**: v4

## Browser Compatibility

### Required Features
- Web Audio API
- MediaRecorder API
- ES6 Modules
- Fetch API

### Supported Browsers
- Chrome 66+
- Firefox 76+
- Safari 14.1+
- Edge 79+

### Not Supported
- Internet Explorer (any version)
- Opera Mini
- Older mobile browsers

## Deployment

### Production Setup

1. **Configure domain** (e.g., `repl.h4ks.com`)
   ```nginx
   server {
       listen 80;
       server_name repl.h4ks.com;

       location / {
           proxy_pass http://localhost:8080;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

2. **Enable HTTPS** (Let's Encrypt)
   ```bash
   certbot --nginx -d repl.h4ks.com
   ```

3. **Update MinIO endpoint** (if different)
   Edit `public/js/storage-client.js` with production endpoint

4. **Deploy with Docker Compose**
   ```bash
   docker compose up -d --build
   ```

### Environment Variables

Create `.env` file for sensitive configuration:

```env
MINIO_ENDPOINT=https://s3-api.t3ks.com
MINIO_BUCKET=replradio-uploads
```

Update `storage-client.js` to read from config if needed.

## Troubleshooting

### Strudel not loading
- Check browser console for errors
- Verify CDN is accessible: `https://unpkg.com/@strudel/repl@latest`
- Clear browser cache

### Code sharing fails
- Verify MinIO is accessible
- Check bucket policy (should allow anonymous PUT)
- Ensure file size < 1MB
- Check browser CORS settings

### Recording not working
- Ensure HTTPS (required for MediaRecorder in some browsers)
- Check microphone permissions (may be requested)
- Verify Web Audio API is supported
- Check browser console for errors

### Audio playback issues
- Start playback before recording
- Check browser audio permissions
- Verify speakers/headphones are connected
- Try different browser

## License

This project uses:
- **Strudel**: AGPL-3.0 (copyleft license)
- **audiobuffer-to-wav**: MIT License

As Strudel uses AGPL-3.0, derivative works must also be open source under AGPL-3.0 or compatible license.

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## Acknowledgments

- [Strudel](https://strudel.cc/) - TidalCycles in the browser
- [MinIO](https://min.io/) - High-performance S3-compatible storage
- [audiobuffer-to-wav](https://github.com/Jam3/audiobuffer-to-wav) - WAV encoding library

## Support

- **Issues**: GitHub Issues
- **Documentation**: [Strudel Docs](https://strudel.cc/technical-manual/)
- **Community**: [Strudel Discord](https://discord.gg/strudel)

---

**Made with ♥ by H4KS** | Powered by Strudel & MinIO
