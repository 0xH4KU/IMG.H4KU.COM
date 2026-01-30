# Admin Guide

This guide describes the admin UI flow for sharing and batch operations.

## Access

1. Open `https://admin.img.h4ku.com/console`
2. Log in with `ADMIN_PASSWORD`

## Share (Delivery) Flow

### Share selected images
1. Select images (checkbox) in the grid
2. Use the bulk bar and click **Delivery**
3. (Optional) set a password
4. Copy the generated share link

### Share a folder
1. Open the folder menu (three dots)
2. Click **Share**
3. Set title and password if needed

### Revoke a share
1. Click the **Deliveries** icon in the header
2. Find the share and click **Revoke**

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

## Temp Folder Cleanup

The admin panel triggers daily cleanup for `temp/` on load. You can also run it manually:

1. Click the **Tools** icon in the header
2. Run **Temp cleanup (30d)**

## Monitoring & Logs

1. Click the **Tools** icon
2. View storage usage and thresholds
3. Review error logs or clear them

## Maintenance Tasks

From the **Tools** modal you can:

- Cleanup orphan metadata
- Check broken links
- Scan duplicates (hash)
- Export metadata backup
