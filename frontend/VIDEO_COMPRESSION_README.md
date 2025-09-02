# Video Compression Guide for Metropoly

## Problem
Your videos are too large for Git LFS and deployment platforms:
- **The Eagles Highlights at The Sphere 2025.mp4**: 135MB
- **Eagles_Highlights_Compressed.mp4**: 143MB (ironically larger!)
- Many other videos over 20MB

This causes:
- Git LFS storage quota exceeded
- Netlify/Render deployment failures
- Slow repository cloning
- High bandwidth usage

## Solution: Video Compression

### Option 1: Automated Compression (Recommended)

#### Prerequisites
1. **Install FFmpeg**:
   - **Windows**: Download from [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html)
   - **macOS**: `brew install ffmpeg`
   - **Ubuntu**: `sudo apt install ffmpeg`

#### Method A: Python Script (Cross-platform)
```bash
# Run the compression script
python compress_videos.py
```

#### Method B: Windows Batch Script
```bash
# Double-click or run in Command Prompt
compress_videos.bat
```

### Option 2: Manual Compression

For individual videos, use these FFmpeg commands:

#### Large Videos (>50MB) - Heavy Compression
```bash
ffmpeg -i "input.mp4" -c:v libx264 -preset medium -crf 25 -b:v 1500k -maxrate 2000k -bufsize 3000k -c:a aac -b:a 128k -ar 44100 -vf "scale=1280:720:force_original_aspect_ratio=decrease" -r 30 -movflags +faststart -y "output.mp4"
```

#### Medium Videos (20-50MB) - Moderate Compression
```bash
ffmpeg -i "input.mp4" -c:v libx264 -preset medium -crf 23 -b:v 1200k -maxrate 1500k -bufsize 2000k -c:a aac -b:a 128k -ar 44100 -vf "scale=1280:720:force_original_aspect_ratio=decrease" -r 30 -movflags +faststart -y "output.mp4"
```

#### Small Videos (<20MB) - Light Compression
```bash
ffmpeg -i "input.mp4" -c:v libx264 -preset medium -crf 20 -b:v 1000k -maxrate 1200k -bufsize 1500k -c:a aac -b:a 128k -ar 44100 -vf "scale=1280:720:force_original_aspect_ratio=decrease" -r 30 -movflags +faststart -y "output.mp4"
```

## Compression Settings Explained

### Quality Levels
- **CRF (Constant Rate Factor)**:
  - 18-22: High quality (larger files)
  - 23-28: Good quality (balanced)
  - 29+: Lower quality (smaller files)

### Resolution
- **1280x720 (720p)**: Good balance of quality and size
- **1920x1080 (1080p)**: Higher quality, larger files
- **640x360 (360p)**: Lower quality, smaller files

### Bitrate
- **Video**: 1000k-1500k for most content
- **Audio**: 128k AAC for good quality

## Step-by-Step Process

### 1. Compress Videos
```bash
# Run compression script
python compress_videos.py
```

### 2. Review Compressed Videos
Check the `Videos/compressed/` directory and verify quality is acceptable.

### 3. Replace Original Videos
```bash
# Run replacement script
python replace_videos.py
```

This will:
- Create backup of original videos in `Videos/backup_original/`
- Replace original videos with compressed versions
- Keep the same filenames (no code changes needed)
- Clean up temporary files

### 4. Test Your Game
Ensure all videos still work correctly in your game.

### 5. Commit and Deploy
```bash
git add .
git commit -m "Compress videos to reduce file sizes"
git push
```

## Expected Results

### File Size Reductions
- **Large videos (>50MB)**: 80-90% reduction
- **Medium videos (20-50MB)**: 70-80% reduction  
- **Small videos (<20MB)**: 50-70% reduction

### Example Reductions
- `The Eagles Highlights at The Sphere 2025.mp4`: 135MB → ~15MB
- `Eagles_Highlights_Compressed.mp4`: 143MB → ~15MB
- `WNBA (1).mp4`: 38MB → ~8MB

## Alternative Solutions

### Option 3: External Video Hosting
If compression isn't sufficient, consider hosting videos externally:

#### YouTube/Video Platforms
```javascript
// Instead of local video files
const videoUrl = "https://www.youtube.com/embed/VIDEO_ID";
```

#### CDN Hosting
- Upload videos to AWS S3, Cloudflare, or similar
- Reference via URLs instead of local files

### Option 4: Remove Unused Videos
Check which videos are actually used in your game and remove unused ones.

## Troubleshooting

### FFmpeg Not Found
```
Error: ffmpeg is not installed or not in PATH
```
**Solution**: Install FFmpeg and add to system PATH.

### Compression Fails
```
Error: [ffmpeg error message]
```
**Solutions**:
1. Check if input file exists and is valid
2. Ensure sufficient disk space
3. Try different compression settings

### Quality Too Low
If compressed videos look too poor:
1. Increase CRF value (lower number = better quality)
2. Increase bitrate
3. Use higher resolution

### Quality Too High (Files Still Too Large)
If files are still too large:
1. Decrease CRF value (higher number = lower quality)
2. Decrease bitrate
3. Use lower resolution

## Git LFS Configuration

After compression, ensure your `.gitattributes` file includes:

```
*.mp4 filter=lfs diff=lfs merge=lfs -text
*.avi filter=lfs diff=lfs merge=lfs -text
*.mov filter=lfs diff=lfs merge=lfs -text
*.mkv filter=lfs diff=lfs merge=lfs -text
*.webm filter=lfs diff=lfs merge=lfs -text
```

## Deployment Considerations

### Netlify
- File size limit: 100MB per file
- Total build size limit: 300MB
- Compressed videos should be well under these limits

### Render
- Similar limits apply
- Compressed videos should work fine

## Backup and Recovery

The replacement script creates backups in `Videos/backup_original/`. To restore:

```bash
# Copy original videos back
cp Videos/backup_original/* Videos/
```

## Performance Impact

### Benefits
- Faster repository cloning
- Reduced bandwidth usage
- Successful deployments
- Lower storage costs

### Considerations
- Slightly lower video quality
- May need to re-compress if quality is unacceptable

## Support

If you encounter issues:
1. Check the error messages
2. Verify FFmpeg installation
3. Try manual compression for problematic files
4. Consider external hosting for very large videos
