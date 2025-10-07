# Troubleshooting Guide

## Error: "Custom element not found: custom:nordpool-scheduler-card"

This error means Home Assistant can't find or load your custom card. Follow these steps:

### 1. Verify the Build

```bash
# Make sure the card is built
yarn build

# Check the file exists
ls -lh dist/nordpool-scheduler-card.js
```

You should see a ~46KB file.

### 2. Test the Card Locally

Open `test-card.html` in your browser:

```bash
# If you have Python installed
python3 -m http.server 8000

# Or with Node.js
npx serve .
```

Then visit `http://localhost:8000/test-card.html` and check if you see "✅ Card loaded successfully!"

### 3. Check File Location in Home Assistant

The file must be in the correct location on your Home Assistant server:

```
<HA_config_directory>/
  └── www/
      └── nordpool-scheduler-card/
          └── nordpool-scheduler-card.js
```

**Examples:**

- Docker: `/config/www/nordpool-scheduler-card/nordpool-scheduler-card.js`
- Home Assistant OS: `/config/www/nordpool-scheduler-card/nordpool-scheduler-card.js`
- Python venv: `~/.homeassistant/www/nordpool-scheduler-card/nordpool-scheduler-card.js`

### 4. Copy the File to Home Assistant

```bash
# Example: Using SCP to remote Home Assistant
scp dist/nordpool-scheduler-card.js user@homeassistant:/config/www/nordpool-scheduler-card/

# Example: Docker with docker cp
docker cp dist/nordpool-scheduler-card.js homeassistant:/config/www/nordpool-scheduler-card/

# Example: If HA is on the same machine
cp dist/nordpool-scheduler-card.js /path/to/ha/config/www/nordpool-scheduler-card/
```

### 5. Register the Resource in Home Assistant

#### Option A: Via UI (Recommended)

1. Go to **Settings** → **Dashboards** → **Resources** (top right menu)
2. Click **"+ Add Resource"**
3. **URL**: `/local/nordpool-scheduler-card/nordpool-scheduler-card.js`
4. **Resource type**: JavaScript Module
5. Click **"Create"**

#### Option B: Via configuration.yaml

```yaml
lovelace:
  resources:
    - url: /local/nordpool-scheduler-card/nordpool-scheduler-card.js
      type: module
```

### 6. Clear Browser Cache

**Hard refresh** (this is important!):

- **Chrome/Edge**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- **Firefox**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- **Safari**: Cmd+Option+R

Or clear cache:

1. F12 to open DevTools
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### 7. Check Browser Console

1. Press **F12** to open Developer Tools
2. Go to **Console** tab
3. Refresh the page (Ctrl+Shift+R)

#### What to look for:

**✅ Success - you should see:**

```
 NORDPOOL-SCHEDULER-CARD  v1.0.0
```

**❌ File not loading - you'll see:**

```
GET http://homeassistant.local:8123/local/nordpool-scheduler-card/nordpool-scheduler-card.js net::ERR_FAILED 404
```

→ **Solution**: Check file path and location (step 3-4)

**❌ JavaScript error - you'll see:**

```
Uncaught SyntaxError: Unexpected token '<'
```

→ **Solution**: File is corrupted or HTML error page was served instead. Rebuild: `yarn build`

**❌ CORS error:**

```
Access to script at '...' from origin '...' has been blocked by CORS
```

→ **Solution**: Use `/local/...` path, not `http://...` external URL

### 8. Verify Card Registration

In browser console, run:

```javascript
customElements.get('nordpool-scheduler-card');
```

- If it returns `undefined`: Card didn't load
- If it returns a class: Card is registered ✅

### 9. Check Lovelace Configuration

When adding the card to your dashboard:

```yaml
type: custom:nordpool-scheduler-card # ← Must start with "custom:"
entity: sensor.nordpool_scheduler_xxx # ← Replace with your entity
name: My Scheduler
```

### 10. Restart Home Assistant

Sometimes a full restart helps:

1. Go to **Settings** → **System** → **Restart**
2. Click **"Restart Home Assistant"**

### 11. Check Permissions

Make sure the www folder is readable:

```bash
# On your HA server
ls -la /config/www/nordpool-scheduler-card/
```

Should show something like:

```
-rw-r--r-- 1 homeassistant homeassistant 46xxx nordpool-scheduler-card.js
```

## Still Not Working?

### Enable Debug Logging

Add to `configuration.yaml`:

```yaml
logger:
  default: warning
  logs:
    frontend: debug
```

### Check Network Tab

1. F12 → **Network** tab
2. Filter: **JS**
3. Refresh page (Ctrl+Shift+R)
4. Find `nordpool-scheduler-card.js`
   - **Status 200**: File loaded successfully
   - **Status 404**: File not found
   - **Status 304**: Cached (clear cache)

### Common Issues

| Error                    | Cause                     | Solution                      |
| ------------------------ | ------------------------- | ----------------------------- |
| 404 Not Found            | File not in `www/` folder | Copy file to correct location |
| Custom element not found | Resource not registered   | Add resource in HA settings   |
| Blank card               | Configuration missing     | Check entity ID exists        |
| Card doesn't update      | Cache issue               | Hard refresh (Ctrl+Shift+R)   |
| JavaScript error         | Corrupted build           | Run `yarn build` again        |

### Development Server Method

For testing during development:

1. **Start dev server** (in your dev environment):

   ```bash
   yarn start
   ```

2. **Add resource in HA** pointing to dev server:

   ```
   http://YOUR_DEV_IP:5000/nordpool-scheduler-card.js
   ```

3. Changes will auto-reload!

## Need Help?

1. Check the browser console (F12) for errors
2. Run `test-card.html` to verify the build works
3. Verify file location: `<HA>/www/nordpool-scheduler-card/nordpool-scheduler-card.js`
4. Hard refresh browser (Ctrl+Shift+R)
5. Check resource is registered in HA
6. Restart Home Assistant

Still stuck? Open an issue with:

- Browser console screenshot
- Network tab screenshot
- Your HA installation method (Docker/OS/Core)
- Card configuration YAML
