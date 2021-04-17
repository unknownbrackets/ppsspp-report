'use strict';

const execFile = require('child_process').execFile;
const jpegRecompress = require('jpeg-recompress-bin');
const mozjpeg = require('mozjpeg');
const path = require('path');
const fs = require('fs');

// We run these conversions not for optimization, but for security.
// Re-encoding the image will often remove nasty stuff from it.
module.exports.convertImage = function (src, dest, type, cb)
{
	if (type === 'jpg')
	{
		execFile(jpegRecompress, ['--quality', 'high', '--min', '60', '--no-copy', src, dest], function (err)
		{
			if (err)
				execFile(mozjpeg, ['-quality', '90', '-optimize', '-outfile', dest, src], cb);
			else
				return cb(null);
		});
	}
	else if (type === 'png')
	{
		const binPath = require('optipng-bin');
		if (path.resolve(dest) !== path.resolve(src) && fs.existsSync(dest))
		{
			fs.unlinkSync(dest);
		}

		execFile(binPath, ['-force', '-strip', 'all', src, '-out', dest, '-o', 5], cb);
	}
	else
		cb(new Error('Invalid type: ' + type));
};
