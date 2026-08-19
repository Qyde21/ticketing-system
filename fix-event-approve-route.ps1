# Run this from your project root
# Usage: powershell -ExecutionPolicy Bypass -File fix-event-approve-route.ps1
#
# app/api/admin/events/[id]/approve/route.ts was broken: an automated
# audit-logging insertion added "await writeAuditLog(...)" before every
# return statement, including the 403/404/400 failure branches, and did
# so BEFORE "const { id } = await params" was even declared - causing a
# build-breaking "used before declaration" error. It also logged
# "event.approve" as if it succeeded even on failure paths, which is
# wrong regardless of the syntax bug.
#
# This fixes both: moves the params destructuring to the top, and keeps
# only the ONE legitimate audit log call - the one that runs after the
# event is actually approved and published, right before returning
# success. The other three admin action routes I checked alongside this
# one were confirmed fine (an earlier garbled terminal paste made them
# look broken too, but the clean output showed they were not).

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

$path = "app\api\admin\events\[id]\approve\route.ts"
$content = @'
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import { sendEventApprovedEmail } from '@/lib/email';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const [event] = await sql`
    SELECT e.id, e.title, e.slug, e.status, u.full_name AS organizer_name, u.email AS organizer_email
    FROM events e
    JOIN users u ON u.id = e.organizer_id
    WHERE e.id = ${id}
  `;
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.status !== 'pending_review') {
    return NextResponse.json({ error: 'Only events pending review can be approved' }, { status: 400 });
  }

  await sql`UPDATE events SET status = 'published', updated_at = now() WHERE id = ${id}`;

  try {
    await sendEventApprovedEmail({
      toEmail: event.organizer_email,
      organizerName: event.organizer_name,
      eventTitle: event.title,
      eventUrl: `${req.nextUrl.origin}/events/${event.slug || event.id}`,
    });
  } catch (emailErr) {
    console.error('Failed to send event approval email:', emailErr);
  }

  revalidateTag('events', 'max');

  await writeAuditLog({
    actorId: session?.userId,
    action: 'event.approve',
    entityType: 'event',
    entityId: id,
  });

  return NextResponse.json({ success: true });
}

'@
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)

if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "ERROR: file was not created!" -ForegroundColor Red
} else {
    Write-Host "Confirmed on disk." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Green
    Write-Host "  git add ."
    Write-Host "  git commit -m ""Fix: broken event approve route (used-before-declared id, bad audit log placement)"""
    Write-Host "  git push origin main"
}
