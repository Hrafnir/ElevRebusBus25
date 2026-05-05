function parseMultipart(req, maxBytes = 100 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) {
      reject(new Error('Mangler multipart boundary.'));
      return;
    }

    const boundary = boundaryMatch[1] || boundaryMatch[2];
    const chunks = [];
    let totalBytes = 0;

    req.on('data', chunk => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        reject(new Error('Filen er for stor.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        resolve(parseParts(Buffer.concat(chunks), boundary));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function parseParts(buffer, boundary) {
  const body = buffer.toString('binary');
  const delimiter = `--${boundary}`;
  const rawParts = body.split(delimiter).slice(1, -1);
  const fields = {};
  const files = {};

  for (const rawPart of rawParts) {
    const part = rawPart.replace(/^\r\n/, '').replace(/\r\n$/, '');
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const rawHeaders = part.slice(0, headerEnd);
    const content = part.slice(headerEnd + 4);
    const disposition = rawHeaders.match(/content-disposition:\s*form-data;\s*([^\r\n]+)/i);
    if (!disposition) continue;

    const name = readDispositionValue(disposition[1], 'name');
    const filename = readDispositionValue(disposition[1], 'filename');
    const contentTypeMatch = rawHeaders.match(/content-type:\s*([^\r\n]+)/i);
    const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';

    if (filename) {
      files[name] = {
        filename,
        contentType,
        buffer: Buffer.from(content, 'binary')
      };
    } else {
      fields[name] = Buffer.from(content, 'binary').toString('utf8');
    }
  }

  return { fields, files };
}

function readDispositionValue(disposition, key) {
  const match = disposition.match(new RegExp(`${key}="([^"]*)"`, 'i'));
  return match ? match[1] : null;
}

module.exports = { parseMultipart };
