'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CoverUpload({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess(false);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data.error?.message || 'Upload failed');

      setPreviewUrl(data.secure_url);

      const updateRes = await fetch(`/api/events/${eventId}/cover`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverImageUrl: data.secure_url }),
      });

      if (!updateRes.ok) throw new Error('Failed to save cover image');

      setSuccess(true);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ fontWeight: 600 }}>Upload new cover image</label>
      <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} />
      {uploading && <p style={{ color: '#666' }}>Uploading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>Cover image updated successfully!</p>}
      {previewUrl && (
        <img
          src={previewUrl}
          alt="New cover preview"
          style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8 }}
        />
      )}
      <a href="/organizer/dashboard" style={{ color: '#6366f1', marginTop: 8 }}>
        Back to dashboard
      </a>
    </div>
  );
}
