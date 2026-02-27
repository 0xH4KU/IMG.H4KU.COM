# Admin Guide

This guide describes the admin UI flow for sharing, batch operations, trash, and maintenance.

## Access

1. Open `https://admin.img.h4ku.com/console`
2. Log in with `ADMIN_PASSWORD`

---

## Share (Delivery) Flow

### Share selected images
1. Select images (checkbox) in the grid
2. Use the bulk bar and click **Delivery**
3. (Optional) set a password
4. Copy the generated share link (uses `delivery.h4ku.com`)

Share pages include:
- **Lightbox viewer** — Click any image to enlarge, navigate with ←/→ arrows
- **Skeleton loading** — Smooth placeholder animations while images load
- **Password rate limiting** — 10 attempts per 5 minutes per IP

### Share a folder
1. Open the folder menu (three dots)
2. Click **Share**
3. Set title and password if needed

### Revoke a share
1. Click the **Shares** icon in the header
2. Find the share and click **Revoke**

---

## Trash (Recycle Bin)

Deleted images are moved to a trash folder instead of being permanently removed.

### Delete images
1. Select images → Click **Delete** in bulk bar, or
2. Right-click an image → **Delete**
3. Images move to `.trash/` folder

### View trash
1. Click the **Trash** folder in the sidebar

### Restore images
1. Open the Trash folder
2. Select images to restore
3. Click **Restore** — images return to their original folder

### Permanent delete
1. Open the Trash folder
2. Select images → **Permanent Delete**
3. This action cannot be undone

### Empty trash
1. Open the Trash folder
2. Click **Empty Trash** to permanently delete all trashed items

---

## Batch Operations

### Batch rename
1. Select images
2. Click **Rename** in the bulk bar
3. Set find/replace and prefix/suffix options
4. Preview changes and apply
5. Metadata (tags/favorites) is automatically preserved

### Batch move
1. Select images
2. Click **Move** in the bulk bar
3. Choose a target folder (blank = root)
4. Metadata is automatically synced to new locations

### Batch download
1. Select images or open a folder
2. Click **Download** in the bulk bar
3. Images are packaged as ZIP and downloaded
4. Folder structure is preserved in the ZIP

### Batch tag operations
1. Select images
2. Click **Tags** in the bulk bar
3. Choose to add or remove tags
4. Select tag colors to apply

---

## Temp Folder Cleanup

The admin panel triggers daily cleanup for `temp/` on load. You can also run it manually:

1. Click the **Tools** icon in the header
2. Run **Temp cleanup (30d)**

---

## Monitoring & Logs

1. Click the **Tools** icon
2. View storage usage and thresholds
3. Review error logs or clear them

---

## Maintenance Tasks

From the **Tools** modal you can:

- Cleanup orphan metadata
- Check broken links
- Scan duplicates (hash)
- Export metadata backup

---

## Regression Test Checklist

Manual verification checklist for core functionality before deployment.

### Upload
- [ ] Single file upload works
- [ ] Multiple file upload works
- [ ] Drag-and-drop upload works
- [ ] Folder upload preserves structure
- [ ] Thumbnail is generated
- [ ] Upload to specific folder works
- [ ] Large file upload (>10MB) works, shows real progress %
- [ ] Duplicate detection works
- [ ] Rate limiting works (60/10min)

### Share / Delivery
- [ ] Create delivery with single item
- [ ] Create delivery with multiple items
- [ ] Create delivery with password
- [ ] Create folder delivery
- [ ] Copy share link works
- [ ] Share page loads correctly
- [ ] Password-protected share requires password
- [ ] Download single item from share
- [ ] Download all items (zip) from share
- [ ] Revoke delivery works

### Trash
- [ ] Delete single image moves to trash
- [ ] Delete multiple images moves to trash
- [ ] Trash folder shows deleted items
- [ ] Restore single image works
- [ ] Restore multiple images works
- [ ] Permanent delete works
- [ ] Empty trash works

### Rename
- [ ] Rename single image works
- [ ] Bulk rename works
- [ ] Rename preserves extension
- [ ] Rename updates metadata

### Move
- [ ] Move single image to folder
- [ ] Move multiple images to folder
- [ ] Move to new folder (create)
- [ ] Move updates file paths correctly

### Metadata
- [ ] Add tag to image
- [ ] Remove tag from image
- [ ] Bulk add tags
- [ ] Bulk remove tags
- [ ] Toggle favorite
- [ ] Filter by tag works
- [ ] Filter by favorite works
- [ ] Metadata persists after refresh

### Folders
- [ ] Create new folder
- [ ] Rename folder
- [ ] Merge folders
- [ ] Delete folder
- [ ] Folder counts update correctly

### Authentication
- [ ] Login with correct password
- [ ] Login with wrong password fails
- [ ] Token persists across refresh
- [ ] Logout clears token
- [ ] Expired token triggers re-login
- [ ] 401 response triggers logout

### UI/UX
- [ ] Grid view displays correctly
- [ ] List view displays correctly
- [ ] Virtual scroll works smoothly
- [ ] Group by date works
- [ ] Group by type works
- [ ] Group by tag works
- [ ] Search/filter works
- [ ] Context menu appears on right-click
- [ ] Keyboard shortcuts work
- [ ] Mobile responsive layout works

### Edge Cases
- [ ] Empty folder displays correctly
- [ ] Long file names truncate properly
- [ ] Special characters in file names handled
- [ ] Network error shows user-friendly message
- [ ] Concurrent operations don't corrupt data

---

### Quick Smoke Test (5 min)

1. Login
2. Upload an image
3. Add a tag
4. Create a delivery
5. Open share link in incognito
6. Delete the image
7. Restore from trash
8. Logout

If all 8 steps pass, basic functionality is working.
