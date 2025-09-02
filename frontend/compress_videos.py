#!/usr/bin/env python3
"""
Video Compression Script for Metropoly Game
This script compresses videos to reduce file sizes for Git LFS and deployment.
"""

import os
import subprocess
import sys
from pathlib import Path

def get_video_info(file_path):
    """Get video information using ffprobe"""
    try:
        cmd = [
            'ffprobe', '-v', 'quiet', '-print_format', 'json',
            '-show_format', '-show_streams', str(file_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            import json
            data = json.loads(result.stdout)
            return data
    except Exception as e:
        print(f"Error getting video info for {file_path}: {e}")
    return None

def compress_video(input_path, output_path, target_size_mb=10, quality='medium'):
    """
    Compress video to target size using ffmpeg
    
    Args:
        input_path: Path to input video
        output_path: Path to output video
        target_size_mb: Target file size in MB
        quality: 'low', 'medium', 'high'
    """
    
    # Quality presets
    quality_presets = {
        'low': {
            'video_bitrate': '800k',
            'audio_bitrate': '128k',
            'resolution': '640:360',
            'fps': '24'
        },
        'medium': {
            'video_bitrate': '1500k',
            'audio_bitrate': '192k',
            'resolution': '1280:720',
            'fps': '30'
        },
        'high': {
            'video_bitrate': '2500k',
            'audio_bitrate': '256k',
            'resolution': '1920:1080',
            'fps': '30'
        }
    }
    
    preset = quality_presets[quality]
    
    # Calculate target bitrate based on file size
    target_size_bits = target_size_mb * 8 * 1024 * 1024  # Convert MB to bits
    duration = get_video_duration(input_path)
    if duration:
        target_bitrate = int((target_size_bits * 0.9) / duration)  # 90% for video, 10% for audio
        video_bitrate = int(target_bitrate * 0.85)  # 85% for video
        audio_bitrate = int(target_bitrate * 0.15)  # 15% for audio
    else:
        video_bitrate = preset['video_bitrate']
        audio_bitrate = preset['audio_bitrate']
    
    # Build ffmpeg command
    cmd = [
        'ffmpeg', '-i', str(input_path),
        '-c:v', 'libx264',  # H.264 codec
        '-preset', 'medium',  # Compression preset
        '-crf', '23',  # Constant Rate Factor (18-28 is good, lower = better quality)
        '-b:v', str(video_bitrate),
        '-maxrate', str(int(video_bitrate * 1.5)),  # Max bitrate
        '-bufsize', str(int(video_bitrate * 2)),  # Buffer size
        '-c:a', 'aac',  # Audio codec
        '-b:a', str(audio_bitrate),
        '-ar', '44100',  # Audio sample rate
        '-vf', f'scale={preset["resolution"]}:force_original_aspect_ratio=decrease',  # Scale video
        '-r', preset['fps'],  # Frame rate
        '-movflags', '+faststart',  # Optimize for web streaming
        '-y',  # Overwrite output file
        str(output_path)
    ]
    
    print(f"Compressing {input_path.name}...")
    print(f"Target size: {target_size_mb}MB, Quality: {quality}")
    print(f"Command: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            # Get output file size
            output_size = os.path.getsize(output_path) / (1024 * 1024)  # MB
            print(f"✅ Success! Output size: {output_size:.1f}MB")
            return True
        else:
            print(f"❌ Error: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def get_video_duration(file_path):
    """Get video duration in seconds"""
    try:
        cmd = [
            'ffprobe', '-v', 'quiet', '-show_entries', 'format=duration',
            '-of', 'csv=p=0', str(file_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            return float(result.stdout.strip())
    except:
        pass
    return None

def get_file_size_mb(file_path):
    """Get file size in MB"""
    return os.path.getsize(file_path) / (1024 * 1024)

def main():
    videos_dir = Path("Videos")
    compressed_dir = Path("Videos/compressed")
    
    # Create compressed directory
    compressed_dir.mkdir(exist_ok=True)
    
    # Video compression settings
    compression_settings = {
        # Large videos (>50MB) - compress heavily
        'large': {'target_size': 15, 'quality': 'medium'},
        # Medium videos (20-50MB) - moderate compression
        'medium': {'target_size': 8, 'quality': 'medium'},
        # Small videos (<20MB) - light compression
        'small': {'target_size': 5, 'quality': 'high'}
    }
    
    # Get all video files
    video_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm']
    video_files = []
    
    for ext in video_extensions:
        video_files.extend(videos_dir.glob(f"*{ext}"))
    
    print(f"Found {len(video_files)} video files")
    print("=" * 50)
    
    # Process each video
    for video_file in video_files:
        if 'compressed' in str(video_file):
            continue  # Skip already compressed files
            
        original_size = get_file_size_mb(video_file)
        
        # Determine compression settings based on file size
        if original_size > 50:
            settings = compression_settings['large']
            category = 'LARGE'
        elif original_size > 20:
            settings = compression_settings['medium']
            category = 'MEDIUM'
        else:
            settings = compression_settings['small']
            category = 'SMALL'
        
        print(f"\n📹 {video_file.name}")
        print(f"   Size: {original_size:.1f}MB ({category})")
        print(f"   Target: {settings['target_size']}MB ({settings['quality']} quality)")
        
        # Create output filename
        output_file = compressed_dir / f"compressed_{video_file.name}"
        
        # Compress video
        success = compress_video(
            video_file, 
            output_file,
            target_size_mb=settings['target_size'],
            quality=settings['quality']
        )
        
        if success:
            compressed_size = get_file_size_mb(output_file)
            reduction = ((original_size - compressed_size) / original_size) * 100
            print(f"   ✅ Compressed: {compressed_size:.1f}MB ({reduction:.1f}% reduction)")
        else:
            print(f"   ❌ Compression failed")
    
    print("\n" + "=" * 50)
    print("🎉 Compression complete!")
    print(f"📁 Compressed videos saved to: {compressed_dir}")
    print("\nNext steps:")
    print("1. Review the compressed videos")
    print("2. Replace original videos with compressed versions")
    print("3. Update your code to reference the new files")
    print("4. Commit and push to Git LFS")

if __name__ == "__main__":
    # Check if ffmpeg is installed
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ ffmpeg is not installed or not in PATH")
        print("Please install ffmpeg:")
        print("  - Windows: Download from https://ffmpeg.org/download.html")
        print("  - macOS: brew install ffmpeg")
        print("  - Ubuntu: sudo apt install ffmpeg")
        sys.exit(1)
    
    main()
