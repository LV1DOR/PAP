'use server';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import sharp from 'sharp';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/jpg'];

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('image');

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    // Validate MIME type
    if (!ALLOWED_MIMES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPEG and PNG allowed.' }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process with Sharp: create optimized version and thumbnail
    const originalMetadata = await sharp(buffer).metadata();
    
    // Optimized large version (max 1600px)
    const largeImage = await sharp(buffer)
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Thumbnail (max 300px)
    const thumbnail = await sharp(buffer)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Generate unique filenames
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(7);
    const largePath = `uploads/${timestamp}-${randomSuffix}-large.jpg`;
    const thumbPath = `uploads/${timestamp}-${randomSuffix}-thumb.jpg`;

    const { error: largeError } = await supabase.storage
      .from('uploads')
      .upload(largePath, largeImage, { contentType: 'image/jpeg' });
    
    if (largeError) {
      return NextResponse.json({ error: largeError.message }, { status: 500 });
    }

    const { error: thumbError } = await supabase.storage
      .from('uploads')
      .upload(thumbPath, thumbnail, { contentType: 'image/jpeg' });
    
    if (thumbError) {
      return NextResponse.json({ error: thumbError.message }, { status: 500 });
    }

    // Attempt to read public URLs from Supabase Storage
    const { data: largeData } = supabase.storage.from('uploads').getPublicUrl(largePath);
    const { data: thumbData } = supabase.storage.from('uploads').getPublicUrl(thumbPath);
    const largeUrl = largeData?.publicUrl || null;
    const thumbUrl = thumbData?.publicUrl || null;

    // Optional: attach uploaded image to an existing report using a service-role key
    const reportId = formData.get('report_id');
    let attached = false;
    let imageRecord = null;

    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

    if (reportId && SERVICE_ROLE_KEY && SUPABASE_URL) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
          auth: { persistSession: false },
        });

        const insertPayload = {
          report_id: reportId.toString(),
          storage_path: largePath,
          thumbnail_path: thumbPath,
          url: largeUrl,
          thumbnail_url: thumbUrl,
          width: originalMetadata.width,
          height: originalMetadata.height,
          size_bytes: largeImage.length,
          created_at: new Date().toISOString(),
        };

        const { data: inserted, error: insertError } = await admin
          .from('report_images')
          .insert([insertPayload])
          .select()
          .single();

        if (insertError) {
          console.error('Failed to attach image to report:', insertError.message);
        } else {
          attached = true;
          imageRecord = inserted;
        }
      } catch (err) {
        console.error('Error creating admin client / inserting report_images:', err.message || err);
      }
    }

    return NextResponse.json({
      storage_path: largePath,
      thumbnail_path: thumbPath,
      url: largeUrl,
      thumbnail_url: thumbUrl,
      width: originalMetadata.width,
      height: originalMetadata.height,
      size_bytes: largeImage.length,
      attached,
      image_record: imageRecord,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
