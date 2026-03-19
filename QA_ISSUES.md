# Photo Album - QA Issues & Resolution Roadmap

## 🔴 CRITICAL ISSUES (Blocking Features)

### Issue 1: Audio Not Playing in Slideshow
**Status:** 🔴 CRITICAL - Needs Investigation  
**Severity:** Slideshow feature incomplete  
**Affected Features:** Music playback, Spotify embeds, YouTube audio

**Problem Description:**
- Users save music URLs (MP3, YouTube, Spotify)
- Music appears in slideshow interface
- NO AUDIO OUTPUT when slideshow plays
- Mute button doesn't work properly

**Root Cause Analysis Needed:**
1. Check if HTML audio element is actually being created
2. Verify audio element source/src is set correctly
3. Check browser console for CORS errors
4. Verify Spotify/YouTube embeds can produce audio (likely NO - embeds don't output)
5. Check if autoplay is being blocked by browser

**Investigation Steps:**
```javascript
// In slideshow.js, add debug logging:
function setupAudioPlayer() {
  console.log('audioUrl:', audioUrl)
  console.log('audioPlayerEl tag:', audioPlayerEl.tagName)
  console.log('audioPlayerEl innerHTML:', audioPlayerEl.innerHTML)
  console.log('audioPlayerEl src:', audioPlayerEl.src)
  // ... rest of code
}

function playAudioIfPossible() {
  console.log('Attempting to play audio')
  console.log('Audio paused?', audioPlayerEl.paused)
  console.log('Audio muted?', audioPlayerEl.muted)
  // ... rest
}
```

**Likely Fix:**
- YouTube/Spotify embeds cannot output audio (they're video players)
- Need to use audio-only player for YouTube (extract audio URL)
- For direct MP3: verify CORS headers allow cross-origin
- Simplify to ONLY support MP3 URLs for now, remove YouTube/Spotify audio

**Recommended Solution:**
```javascript
// For MVP, only support direct MP3 URLs
// Remove YouTube/Spotify audio embeds (they don't work)
// Keep YouTube/Spotify as visual info only
```

---

### Issue 2: HEIC Files Not Rendering After Upload
**Status:** 🔴 CRITICAL  
**Severity:** Images disappear after upload  
**Affected Features:** Photo gallery, slideshow, collages

**Problem Description:**
- HEIC files upload successfully
- Conversion to JPEG happens (backend confirms)
- No thumbnail appears after upload
- Images don't show in album grid
- Slideshow can't find the images

**Root Cause Analysis Needed:**
1. Check if converted JPEG file_path is saved correctly to DB
2. Verify file actually exists in Supabase storage at saved path
3. Check if public URL generation works for converted files
4. May be timing issue: image saved to storage but DB not updated yet

**Investigation Steps:**
1. Upload a HEIC file and watch browser console
2. Check Supabase dashboard → storage "photos" bucket → verify file exists
3. Check Supabase → SQL Editor → query photos table for the album
4. Verify file_path matches storage path exactly
5. Try to manually access the URL in browser

**Likely Fix:**
- HEIC conversion returns Blob, but filename/path handling may be wrong
- Need to check if file is uploading with correct name
- May need to add extension handling for converted files

---

### Issue 3: Music URL Save Has No Feedback
**Status:** 🟡 MEDIUM  
**Severity:** User doesn't know if save worked  
**Affected Features:** Music modal UX

**Problem Description:**
- User clicks "Save" in music modal
- Alert shows "Music URL saved!"
- Modal closes
- User has no way to verify it worked
- No indicator in album view

**Solution:**
1. Remove reliance on JavaScript alert()
2. Add toast/notification system (in top-right)
3. Add visual badge in album hero showing "♪ Music Configured" if music_url exists
4. Show current music URL in album view before editing

**Implementation:**
- Create simple toast notification component
- Show success toast on save
- Add badge showing music status in album-hero-actions
- Display current URL in modal when reopening

---

## 🟡 MEDIUM PRIORITY ISSUES

### Issue 4: Bulk Delete Drag-Select Not Tested
- Implementation done but no real-world QA
- Need to test and verify it works smoothly
- May have edge cases with overlapping selections

### Issue 5: HEIC Thumbnail Preview
- HEIC files should show preview after selection
- Currently no preview while uploading

---

## ✅ TESTING PLAN

### Phase 1: Audio System (This Sprint)
**Goal:** Get audio working or simplify to MVP  
1. [ ] Add debug logging to slideshow.js
2. [ ] Test with direct MP3 URL (no YouTube/Spotify)
3. [ ] Verify browser plays audio element
4. [ ] Fix autoplay issues
5. [ ] If YouTube/Spotify can't output audio, remove them (show error message)

### Phase 2: HEIC Rendering (This Sprint)
**Goal:** HEIC files appear in gallery after upload  
1. [ ] Add logging to upload.js HEIC conversion
2. [ ] Verify file saves to Supabase storage correctly
3. [ ] Check DB records for converted files
4. [ ] Verify public URL works
5. [ ] Test slideshow can display converted HEIC images

### Phase 3: Music UX (Next Sprint)
**Goal:** User has clear feedback  
1. [ ] Implement toast notification system
2. [ ] Show music status badge in album view
3. [ ] Display current URL in music modal
4. [ ] Test save/clear workflows

### Phase 4: Comprehensive QA (Next Sprint)
**Goal:** All features working end-to-end  
1. [ ] Test upload with multiple file types
2. [ ] Test drag-select bulk operations
3. [ ] Test slideshow with all features enabled
4. [ ] Test on mobile devices
5. [ ] Performance testing with 50+ photos

---

## 🛠️ DEBUGGING COMMANDS

**Check Supabase Storage:**
```bash
# In Supabase dashboard → Storage → photos bucket
# Should see files like: {albumId}/{timestamp}_filename.jpg
```

**Check Database:**
```sql
-- Check photos table for recent uploads
SELECT id, album_id, file_path, created_at 
FROM photos 
ORDER BY created_at DESC 
LIMIT 20;

-- Check albums table for music_url
SELECT id, name, music_url 
FROM albums 
LIMIT 10;
```

**Browser Console:**
```javascript
// In slideshow, check audio element
const audio = document.getElementById('slideshow-audio')
console.log(audio)
console.log(audio?.src)
console.log(audio?.paused)
audio?.play() // Try to manually play
```

---

## NEXT STEPS

1. **Deploy QA dashboard** → `/qa-tests.html`
2. **Add debug logging** to js/upload.js and js/slideshow.js
3. **Run Audio Test**:
   - Set test album with MP3 URL
   - Start slideshow
   - Check browser console for errors
   - Verify audio plays
4. **Run HEIC Test**:
   - Upload HEIC file
   - Check Supabase storage for file
   - Check DB for photo record
   - Verify album displays thumbnail
5. **Fix priority issues** based on test results
6. **Document solutions** for future maintenance

---

## REFERENCE: Key File Locations

- Upload logic: `/js/upload.js` → `convertHeicToJpeg()`, `handleFiles()`
- Slideshow: `/js/slideshow.js` → `setupAudioPlayer()`, `togglePlayPause()`
- Music modal: `/album.html` → music-modal, `/js/album.js` → saveMusicUrl()
- QA Dashboard: `/qa-tests.html`
