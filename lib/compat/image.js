'use strict';

const optimage = require('optimage');
const execFile = require('child_process').execFile;
const jpegRecompress = require('jpeg-recompress-bin');

// We run these conversions not for optimization, but for security.
// Re-encoding the image will often remove nasty stuff from it.
module.exports.convertImage = function (src, dest, type, cb)
{
	if (type == 'jpg')
		execFile(jpegRecompress, ['--quality', 'high', '--min', '60', '--no-copy', src, dest], cb);
	else if (type == 'png')
	{
		optimage({
			inputFile: src,
			outputFile: dest,
			level: 5,
			progressive: true,
			arg: ['-force'],
		}, cb);
	}
	else
		cb(new Error('Invalid type: ' + type));
}
