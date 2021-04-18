'use strict';

const fs = require('fs');
const jpegRecompress = require('jpeg-recompress-bin');
const mozjpeg = require('mozjpeg');
const path = require('path');
const util = require('util');
const execFile = util.promisify(require('child_process').execFile);

// We run these conversions not for optimization, but for security.
// Re-encoding the image will often remove nasty stuff from it.
module.exports.convertImage = async function (src, dest, type)
{
	if (type === 'jpg')
	{
		try
		{
			await execFile(jpegRecompress, ['--quality', 'high', '--min', '60', '--no-copy', src, dest]);
		}
		catch (err)
		{
			// Let's try mozjpeg instead.
			await execFile(mozjpeg, ['-quality', '90', '-optimize', '-outfile', dest, src]);
		}
	}
	else if (type === 'png')
	{
		const binPath = require('optipng-bin');
		if (path.resolve(dest) !== path.resolve(src) && fs.existsSync(dest))
			fs.unlinkSync(dest);

		await execFile(binPath, ['-force', '-strip', 'all', src, '-out', dest, '-o', 5]);
	}
	else
		throw new Error('Invalid type: ' + type);
};
