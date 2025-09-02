#!/usr/bin/env python3
"""
Replace original videos with compressed versions
This script helps replace large video files with their compressed counterparts.
"""

import os
import shutil
from pathlib import Path
import re

def backup_original_videos():
    """Create a backup of original videos"""
    videos_dir = Path("Videos")
    backup_dir = Path("Videos/backup_original")
    
    if backup_dir.exists():
        print(f"Backup directory {backup_dir} already exists")
        return backup_dir
    
    backup_dir.mkdir(exist_ok=True)
    
    print("Creating backup of original videos...")
    video_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm']
    
    for ext in video_extensions:
        for video_file in videos_dir.glob(f"*{ext}"):
            if 'compressed' not in str(video_file) and 'backup' not in str(video_file):
                backup_path = backup_dir / video_file.name
                shutil.copy2(video_file, backup_path)
                print(f"  Backed up: {video_file.name}")
    
    print(f"Backup created in: {backup_dir}")
    return backup_dir

def replace_with_compressed():
    """Replace original videos with compressed versions"""
    videos_dir = Path("Videos")
    compressed_dir = Path("Videos/compressed")
    
    if not compressed_dir.exists():
        print("No compressed videos found. Run compression first.")
        return
    
    print("Replacing original videos with compressed versions...")
    
    # Get all compressed videos
    compressed_videos = list(compressed_dir.glob("compressed_*.mp4"))
    
    for compressed_video in compressed_videos:
        # Extract original filename
        original_name = compressed_video.name.replace("compressed_", "")
        original_path = videos_dir / original_name
        
        if original_path.exists():
            # Get file sizes
            original_size = original_path.stat().st_size / (1024 * 1024)  # MB
            compressed_size = compressed_video.stat().st_size / (1024 * 1024)  # MB
            
            print(f"  Replacing: {original_name}")
            print(f"    Original: {original_size:.1f}MB")
            print(f"    Compressed: {compressed_size:.1f}MB")
            print(f"    Reduction: {((original_size - compressed_size) / original_size * 100):.1f}%")
            
            # Replace the file
            shutil.move(compressed_video, original_path)
            print(f"    ✅ Replaced successfully")
        else:
            print(f"  ⚠️  Original not found: {original_name}")
    
    print("Video replacement complete!")

def update_code_references():
    """Update any hardcoded video file references in code"""
    print("Checking for video file references in code...")
    
    # Common file extensions to check
    code_extensions = ['.js', '.html', '.css', '.json', '.md', '.txt']
    
    # Video file patterns to look for
    video_patterns = [
        r'Videos/[^"\s]+\.mp4',
        r'\./Videos/[^"\s]+\.mp4',
        r'videos/[^"\s]+\.mp4'
    ]
    
    files_checked = 0
    references_found = 0
    
    for ext in code_extensions:
        for file_path in Path('.').rglob(f"*{ext}"):
            if 'node_modules' in str(file_path) or '.git' in str(file_path):
                continue
                
            files_checked += 1
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                for pattern in video_patterns:
                    matches = re.findall(pattern, content)
                    if matches:
                        references_found += len(matches)
                        print(f"  Found {len(matches)} video reference(s) in: {file_path}")
                        for match in matches:
                            print(f"    - {match}")
            except Exception as e:
                print(f"  Error reading {file_path}: {e}")
    
    print(f"\nChecked {files_checked} files, found {references_found} video references")
    
    if references_found > 0:
        print("\nNote: Video file references should still work since we're replacing")
        print("the original files with compressed versions of the same names.")

def cleanup_compressed_directory():
    """Remove the compressed directory after replacement"""
    compressed_dir = Path("Videos/compressed")
    
    if compressed_dir.exists():
        try:
            shutil.rmtree(compressed_dir)
            print("Cleaned up compressed directory")
        except Exception as e:
            print(f"Error cleaning up compressed directory: {e}")

def main():
    print("=" * 50)
    print("Video Replacement Script for Metropoly")
    print("=" * 50)
    
    # Step 1: Create backup
    print("\n1. Creating backup of original videos...")
    backup_dir = backup_original_videos()
    
    # Step 2: Replace videos
    print("\n2. Replacing videos with compressed versions...")
    replace_with_compressed()
    
    # Step 3: Update code references
    print("\n3. Checking code references...")
    update_code_references()
    
    # Step 4: Cleanup
    print("\n4. Cleaning up...")
    cleanup_compressed_directory()
    
    print("\n" + "=" * 50)
    print("🎉 Video replacement complete!")
    print("=" * 50)
    print(f"\nBackup of original videos saved to: {backup_dir}")
    print("\nNext steps:")
    print("1. Test your game to ensure videos still work")
    print("2. Commit the changes to Git")
    print("3. Push to your repository")
    print("4. Deploy to Netlify/Render")
    print("\nIf you need to restore original videos:")
    print(f"  Copy files from {backup_dir} back to Videos/")

if __name__ == "__main__":
    main()
