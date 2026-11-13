# Runs the site on your own computer at http://localhost:5173/
# Right-click this file and choose "Run with PowerShell", or run:
#   powershell -ExecutionPolicy Bypass -File serve.ps1
# Nothing is installed and nothing leaves your machine. Close the window to stop.
param([int]$Port = 5173)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'
  '.ico' = 'image/x-icon'; '.txt' = 'text/plain; charset=utf-8'; '.woff2' = 'font/woff2'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "The Scent Shelf is running at http://localhost:$Port/  (Ctrl+C or close this window to stop)"

try {
  while ($listener.IsListening) {
    $task = $listener.GetContextAsync()
    while (-not $task.AsyncWaitHandle.WaitOne(200)) { }
    $ctx = $task.GetAwaiter().GetResult()
    try {
      $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
      if ($path.EndsWith('/')) { $path += 'index.html' }
      $full = [IO.Path]::GetFullPath((Join-Path $root ($path.TrimStart('/') -replace '/', '\')))
      $status = 200
      if (-not $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
        $status = 403; $full = $null
      } elseif (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        if (Test-Path -LiteralPath "$full.html" -PathType Leaf) { $full = "$full.html" }
        else { $status = 404; $full = Join-Path $root '404.html' }
      }
      $ctx.Response.StatusCode = $status
      $ctx.Response.Headers['Cache-Control'] = 'no-store'
      if ($full -and (Test-Path -LiteralPath $full -PathType Leaf)) {
        $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
        if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] } else { $ctx.Response.ContentType = 'application/octet-stream' }
        $bytes = [IO.File]::ReadAllBytes($full)
        $ctx.Response.ContentLength64 = $bytes.Length
        if ($ctx.Request.HttpMethod -ne 'HEAD') { $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length) }
      }
    } catch {
      # a dropped connection should never stop the server
    } finally {
      try { $ctx.Response.Close() } catch { }
    }
  }
} finally {
  $listener.Stop()
}
