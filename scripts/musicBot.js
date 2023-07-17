const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

// 10進数を12進数に変換する関数
function convertDecimalToHex(decimalValue) {
  return decimalValue.toString(12);
}

// 12進数からファイル名に変換する関数
function convertHexToFile(hexValue) {
  const decimalValue = parseInt(hexValue, 12);
  if (decimalValue >= 10) {
    // 10以上はA, B, C...という表現に変換
    return String.fromCharCode(65 + decimalValue - 10) + '.mp3';
  } else {
    return `${decimalValue}.mp3`;
  }
}

// 音声ファイルを結合する関数
function concatAudio(inputFiles, outputFilePath) {
  const ffmpeg = spawn(ffmpegPath, [
    '-i', `concat:${inputFiles.join('|')}`,
    '-c', 'copy',
    outputFilePath
  ]);

  ffmpeg.stdout.on('data', (data) => {
    console.log(`[stdout] ${data}`);
  });

  ffmpeg.stderr.on('data', (data) => {
    console.error(`[stderr] ${data}`);
  });

  ffmpeg.on('close', (code) => {
    console.log(`[ffmpeg] child process exited with code ${code}`);
  });
}

module.exports = (robot) => {
  robot.respond(/play:(.+)/i, (res) => {
    let inputDecimal = parseFloat(res.match[1]);
    let hexValue = convertDecimalToHex(inputDecimal);

    console.log(`[Input] Decimal: ${inputDecimal}`);
    console.log(`[Conversion] Hex: ${hexValue}`);

    // 12進数に対応するファイル名を取得
    const filenames = [];
    for (let i = 0; i < hexValue.length; i++) {
      const filename = convertHexToFile(hexValue[i]);
      filenames.push(filename);
    }

    // ファイルのパスを作成
    const filePaths = filenames.map((filename) =>
      path.join(__dirname, 'sound', filename)
    );

    // 結合した音声ファイルの出力パス（新しいファイルを作成）
    const outputFilename = `${hexValue}.mp3`;
    const outputFilePath = path.join(__dirname, 'output', outputFilename);

    // 音声ファイルを結合
    concatAudio(filePaths, outputFilePath);

    // 結合されたファイルのパスを返す
    res.send({
      path: outputFilePath
    });
  });
};


