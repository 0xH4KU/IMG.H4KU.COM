# Regression Test Checklist

Manual verification checklist for core functionality before deployment.

## Upload

- [ ] Single file upload works
- [ ] Multiple file upload works
- [ ] Drag-and-drop upload works
- [ ] Folder upload preserves structure
- [ ] Thumbnail is generated
- [ ] Upload to specific folder works
- [ ] Large file upload (>10MB) works
- [ ] Duplicate detection works

## Share / Delivery

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

## Trash

- [ ] Delete single image moves to trash
- [ ] Delete multiple images moves to trash
- [ ] Trash folder shows deleted items
- [ ] Restore single image works
- [ ] Restore multiple images works
- [ ] Permanent delete works
- [ ] Empty trash works

## Rename

- [ ] Rename single image works
- [ ] Bulk rename works
- [ ] Rename preserves extension
- [ ] Rename updates metadata

## Move

- [ ] Move single image to folder
- [ ] Move multiple images to folder
- [ ] Move to new folder (create)
- [ ] Move updates file paths correctly

## Metadata

- [ ] Add tag to image
- [ ] Remove tag from image
- [ ] Bulk add tags
- [ ] Bulk remove tags
- [ ] Toggle favorite
- [ ] Filter by tag works
- [ ] Filter by favorite works
- [ ] Metadata persists after refresh

## Folders

- [ ] Create new folder
- [ ] Rename folder
- [ ] Merge folders
- [ ] Delete folder
- [ ] Folder counts update correctly

## Authentication

- [ ] Login with correct password
- [ ] Login with wrong password fails
- [ ] Token persists across refresh
- [ ] Logout clears token
- [ ] Expired token triggers re-login
- [ ] 401 response triggers logout

## UI/UX

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

## Edge Cases

- [ ] Empty folder displays correctly
- [ ] Long file names truncate properly
- [ ] Special characters in file names handled
- [ ] Network error shows user-friendly message
- [ ] Concurrent operations don't corrupt data

---

## Quick Smoke Test (5 min)

1. Login
2. Upload an image
3. Add a tag
4. Create a delivery
5. Open share link in incognito
6. Delete the image
7. Restore from trash
8. Logout

If all 8 steps pass, basic functionality is working.
