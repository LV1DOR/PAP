# Realtime Debugging Checklist

## Quick Verification Steps

### 1. Check Supabase Configuration
- Open Supabase Dashboard → Project Settings → API
- Verify **Realtime** is enabled for your project
- Confirm you have the correct `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`
- Confirm you have the correct `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`

### 2. Enable Table Realtime
In Supabase Dashboard → Database → Replication:
- Ensure `reports` table has **Realtime enabled** (toggle should be ON)
- Ensure `locations` table has **Realtime enabled** (optional but recommended)

### 3. Browser Console Monitoring
Open DevTools (F12) and watch for these logs:

#### On `/locations` page:
```
[Locations Stats Realtime] INSERT {...}
[Locations Stats Realtime] UPDATE {...}
[Locations Stats Realtime] DELETE {...}
```

#### On `/reports` page:
```
[Reports Realtime] INSERT {...}
[Reports Realtime] UPDATE {...}
[Reports Realtime] DELETE {...}
```

#### On `/locations/[slug]` page:
```
[Location Detail Realtime] INSERT for location X {...}
[Location Detail Realtime] UPDATE for location X {...}
```

#### On `/dashboard` page:
```
[Dashboard Realtime] INSERT {...}
[Dashboard Realtime] UPDATE {...}
[Dashboard Realtime] DELETE {...}
```

### 4. Test Live Updates

**Test 1: Create Report**
1. Open `/locations` in one tab
2. Open `/reports/new` in another tab
3. Create a new report for a specific town (e.g., Faro)
4. Check console in `/locations` tab - should see INSERT event
5. Watch town card update instantly with new count

**Test 2: Delete Report**
1. Open `/reports` page
2. Open Supabase Dashboard → Table Editor → `reports`
3. Delete a report row
4. Check console in `/reports` tab - should see DELETE event
5. Watch report disappear from map and list instantly

**Test 3: Update Status**
1. Open `/dashboard` page
2. Click "Validate" on a reported issue
3. Check console - should see UPDATE event
4. Watch status badge change instantly

**Test 4: Multi-Tab Sync**
1. Open `/locations` in two browser tabs side-by-side
2. In Supabase Table Editor, delete all reports for a town
3. Both tabs should update simultaneously
4. Town count should drop to 0 in both tabs

### 5. Network Tab Verification
In DevTools → Network tab:
- Filter by `api/`
- Create a new report
- Verify you see:
  - POST `/api/reports` (201 Created)
  - GET `/api/locations` (200 OK) - triggered by realtime
  - Response headers include: `Cache-Control: no-store, no-cache`

### 6. Common Issues & Fixes

**Issue: No realtime events in console**
- Check Supabase Realtime is enabled (step 1 & 2)
- Check browser console for Supabase connection errors
- Verify WebSocket connection in Network tab (filter: WS)
- Hard refresh page (Ctrl+Shift+R)

**Issue: Stale data after delete**
- Hard refresh (Ctrl+Shift+R) to clear React state
- Check API response headers include `Cache-Control: no-cache`
- Verify `export const dynamic = 'force-dynamic'` in API route

**Issue: Counts don't update**
- Check that reports have `location_id` set (not null)
- Verify town binding dropdown was used or auto-detect ran
- Check console for stats calculation errors
- Manually trigger: delete and recreate the report

**Issue: Realtime fires but UI doesn't update**
- Check component is calling the `load()` function in callback
- Verify no JavaScript errors in console
- Check that `setData()` or `setReports()` is being called
- Verify component is not unmounting before update completes

### 7. Manual Cache Clear (if needed)
If you still see stale data after fixes:
1. Clear browser cache completely
2. Clear Next.js build cache: `rm -rf .next` (or delete `.next` folder)
3. Restart dev server: `npm run dev`
4. Hard refresh browser: `Ctrl+Shift+R`

### 8. Production Checklist
Before deploying:
- [ ] All API routes have `export const dynamic = 'force-dynamic'`
- [ ] All API responses include no-cache headers
- [ ] All client fetches use `cache: 'no-store'`
- [ ] Realtime subscriptions have cleanup in `return () => supabase.removeChannel(channel)`
- [ ] Console logs can be removed or wrapped in `process.env.NODE_ENV === 'development'`
- [ ] Supabase RLS policies tested for all user roles
- [ ] Realtime tested across multiple browsers/devices simultaneously

## Architecture Summary

### Data Flow
```
User Action (create/update/delete)
    ↓
API Route (force-dynamic, no-cache)
    ↓
Supabase Database Change
    ↓
Realtime Broadcast (WebSocket)
    ↓
Client Subscription Callback
    ↓
Fetch Fresh Data (no-cache)
    ↓
UI Update (setData/setReports)
```

### Key Files Modified
- `/app/api/locations/route.js` - force-dynamic, no-cache
- `/app/api/locations/[slug]/route.js` - force-dynamic, no-cache
- `/app/api/reports/route.js` - force-dynamic, no-cache
- `/app/api/reports/[id]/route.js` - force-dynamic, no-cache
- `/app/api/categories/route.js` - force-dynamic, no-cache
- `/app/locations/page.js` - realtime subscription, no-cache fetch
- `/app/locations/[slug]/page.js` - realtime subscription, no-cache fetch, fixed closure
- `/app/reports/page.js` - realtime subscription, no-cache fetch, console logs
- `/app/dashboard/page.js` - realtime subscription, console logs
- `/lib/locations.js` - batch stats computation

### Performance Notes
- Stats computation changed from 4-5 queries per town to 1 batch query
- Realtime uses WebSocket (low overhead)
- No polling needed
- Clustering reduces marker count on dense maps
- Images lazy-loaded via separate fetch

## Support
If issues persist, check:
1. `development_log.md` for implementation history
2. Supabase logs (Dashboard → Logs)
3. Next.js build output for warnings
4. React DevTools for component state
