# Quick Start Guide

## 1. MinIO Setup (First Time Only)

```bash
# Run the setup script
./setup-minio.sh

# When prompted, enter:
# - ACCESS_KEY: Your MinIO access key
# - SECRET_KEY: Your MinIO secret key
```

## 2. Start the Application

### Option A: Docker (Recommended)
```bash
docker compose up -d
```

Access at: http://localhost:8080

### Option B: Local Development
```bash
# Python
python3 -m http.server 8080 -d public

# OR Node.js
npx http-server public -p 8080
```

Access at: http://localhost:8080

## 3. Usage

1. **Write Strudel code** in the editor
2. **Click PLAY** or press `Ctrl+Enter`
3. **Click SHARE** to get a shareable link
4. **Click RECORD** to save audio as WAV

## 4. Test Code Sharing

Try this example:

```javascript
note("c a f e")
  .s("piano")
  .slow(2)
```

1. Paste the code
2. Click **SHARE**
3. Copy the generated URL (e.g., `http://localhost:8080/xW9kL`)
4. Open URL in new tab to verify code loads

## 5. Automated Recording (Puppeteer)

For headless audio rendering:

```
http://localhost:8080/?autoplay=true&maxlength=30&autorecord=true
```

**Parameters:**
- `autoplay=true` - Auto-start playback
- `maxlength=30` - Duration in seconds
- `autorecord=true` - Auto-start recording

## Troubleshooting

**Strudel not loading?**
- Clear browser cache
- Check console for errors
- Verify internet connection (CDN required)

**Sharing fails?**
- Check MinIO setup: `mc stat h4ks-s3/replradio-uploads`
- Verify bucket policy: `mc anonymous get h4ks-s3/replradio-uploads`

**Recording not working?**
- Use HTTPS or localhost
- Check browser console for errors
- Ensure playback is started first

## Next Steps

- Read full [README.md](README.md) for detailed documentation
- Explore [Strudel examples](https://strudel.cc/examples)
- Check [Strudel tutorial](https://strudel.cc/learn)

---

Need help? Check the [README.md](README.md) or open an issue.
