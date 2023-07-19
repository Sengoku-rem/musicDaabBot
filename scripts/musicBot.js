const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');

const { google } = require('googleapis');
const privatekey = require('./privatekey.json');

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

// 12進数から音名に変換する関数
function convertHexToNote(hexValue) {
  const noteMap = {
    0: 'ラ',
    1: 'ラ#',
    2: 'シ',
    3: 'ド',
    4: 'ド#',
    5: 'レ',
    6: 'レ#',
    7: 'ミ',
    8: 'ファ',
    9: 'ファ#',
    a: 'ソ',
    b: 'ソ#',
  };
  let notes = '';
  for (let i = 0; i < hexValue.length; i++) {
    const note = noteMap[hexValue[i]];
    notes += note + ' ';
  }
  return notes.trim();
}

// 音声ファイルを結合する関数
function concatAudio(inputFiles, outputFilePath) {
  const ffmpeg = spawn(ffmpegPath, [
    '-i',
    `concat:${inputFiles.join('|')}`,
    '-c',
    'copy',
    outputFilePath,
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
  robot.respond(/music:(.+)/i, async (res) => {
    let inputDecimal = parseFloat(res.match[1]);
    if (!Number.isInteger(inputDecimal)) {
      res.send('コマンドは music:整数 です');
      return;
    }

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

    const noteText = convertHexToNote(hexValue);
    res.send(`12進数に直すと: ${hexValue}`);
    res.send(`音階に対応させると: ${noteText}`);
    // 結合されたファイルのパスを返す
    res.send({
      path: outputFilePath,
    });

    // Google Drive に保存
    const drive = google.drive({
      version: 'v3',
      auth: new google.auth.GoogleAuth({
        credentials: privatekey,
        scopes: ['https://www.googleapis.com/auth/drive'],
      }),
    });

    const folderId = '17M6NZ9Zf13NLVf05OhJF5ntj6l9la6gv';
    const fileMetadata = {
      name: outputFilename,
      mimeType: 'audio/mpeg',
      parents: [folderId],
    };
    const media = {
      mimeType: 'audio/mpeg',
      body: fs.createReadStream(outputFilePath),
    };

    // 同じ名前のファイルが存在するかチェック
    drive.files.list(
      {
        q: `'${folderId}' in parents and name='${outputFilename}'`,
        fields: 'files(name)',
      },
      (err, response) => {
        if (err) {
          console.error('Error retrieving file:', err);
        } else {
          const files = response.data.files;
          if (files.length > 0) {
            console.log('File already exists:', outputFilename);
          } else {
            drive.files.create(
              {
                resource: fileMetadata,
                media: media,
                fields: 'id',
              },
              (err, file) => {
                if (err) {
                  console.error('Error creating file:', err);
                } else {
                  console.log('File created:', file);
                }
              }
            );
          }
        }
      }
    );
  });

  robot.respond(/all/i, async (res) => {
    // Google Drive から最新の3つの音声ファイルを取得
    const drive = google.drive({
      version: 'v3',
      auth: new google.auth.GoogleAuth({
        credentials: privatekey,
        scopes: ['https://www.googleapis.com/auth/drive'],
      }),
    });

    const folderId = '17M6NZ9Zf13NLVf05OhJF5ntj6l9la6gv';

    drive.files.list(
      {
        q: `'${folderId}' in parents`,
        fields: 'files(name, createdTime)',
        orderBy: 'createdTime desc',
        pageSize: 3,
      },
      (err, response) => {
        if (err) {
          console.error('Error retrieving files:', err);
        } else {
          const files = response.data.files;
          let fileList = '';
          files.forEach((file) => {
            fileList += `${file.name} - ${file.createdTime}\n`;
          });
          res.send('最新の3つの音声ファイル:\n' + fileList);
          res.send('すべての音声ファイルはこちらから:\n https://drive.google.com/drive/folders/17M6NZ9Zf13NLVf05OhJF5ntj6l9la6gv');
        }
      }
    );
  });
};
