document.addEventListener('DOMContentLoaded', () => {
    const mmlInput = document.getElementById('mmlInput');
    const playBtn = document.getElementById('playBtn');
    const stopBtn = document.getElementById('stopBtn');
    const exportBtn = document.getElementById('exportBtn');
    const statusMessage = document.getElementById('statusMessage');

    let player; // FlMML Player インスタンス
    let isPlaying = false;
    let isExporting = false;

    // FlMMLの初期化
    try {
        player = new FlMML.Player();
        player.on('ready', () => {
            console.log('FlMML Player is ready.');
            playBtn.disabled = false;
            exportBtn.disabled = false;
        });
        player.on('play', () => {
            isPlaying = true;
            playBtn.textContent = '再生中...';
            playBtn.disabled = true;
            stopBtn.disabled = false;
            exportBtn.disabled = true; // 再生中はエクスポートを無効化
            statusMessage.textContent = 'MMLを再生中...';
        });
        player.on('stop', () => {
            isPlaying = false;
            playBtn.textContent = '再生';
            playBtn.disabled = false;
            stopBtn.disabled = true;
            exportBtn.disabled = false;
            statusMessage.textContent = '再生を停止しました。';
        });
        player.on('error', (e) => {
            console.error('FlMML Error:', e);
            statusMessage.textContent = `エラー: ${e.message || 'MMLの解析に失敗しました。'}`;
            playBtn.textContent = '再生';
            playBtn.disabled = false;
            stopBtn.disabled = true;
            exportBtn.disabled = false;
            isPlaying = false;
            isExporting = false;
        });
    } catch (e) {
        statusMessage.textContent = 'FlMMLプレイヤーの初期化に失敗しました。ブラウザをご確認ください。';
        console.error('FlMML initialization error:', e);
        playBtn.disabled = true;
        stopBtn.disabled = true;
        exportBtn.disabled = true;
    }

    // 再生ボタン
    playBtn.addEventListener('click', () => {
        if (!player || isPlaying) return;
        const mmlText = mmlInput.value;
        if (!mmlText.trim()) {
            statusMessage.textContent = 'MMLコードを入力してください。';
            return;
        }
        player.play(mmlText);
    });

    // 停止ボタン
    stopBtn.addEventListener('click', () => {
        if (!player || !isPlaying) return;
        player.stop();
    });

    // MP3保存ボタン
    exportBtn.addEventListener('click', async () => {
        if (!player || isPlaying || isExporting) return;

        const mmlText = mmlInput.value;
        if (!mmlText.trim()) {
            statusMessage.textContent = 'MMLコードを入力してください。';
            return;
        }

        isExporting = true;
        exportBtn.textContent = 'MP3を生成中...';
        exportBtn.disabled = true;
        playBtn.disabled = true;
        stopBtn.disabled = true;
        statusMessage.textContent = 'MP3ファイルを作成中...しばらくお待ちください。';

        try {
            // FlMMLでMMLをレンダリングし、AudioBufferを取得
            const renderDuration = player.getDuration(mmlText) + 1; // 演奏時間に少し余裕を持たせる
            const audioBuffer = await player.render(mmlText, { duration: renderDuration });

            if (!audioBuffer) {
                throw new Error('MMLのレンダリングに失敗しました。');
            }

            // lamejsでMP3にエンコード
            const mp3Encoder = new lamejs.Mp3Encoder(
                audioBuffer.numberOfChannels,
                audioBuffer.sampleRate,
                128 // ビットレート (kbps)
            );

            // AudioBufferをFloat32Arrayの配列に変換
            const channels = [];
            for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
                channels.push(audioBuffer.getChannelData(i));
            }

            const frameSize = 1152; // MP3エンコーダの一般的なフレームサイズ
            const mp3Data = [];

            // チャンネルデータを左右に分割してエンコード (lamejsは左右チャンネルを別々に受け取る)
            for (let i = 0; i < channels[0].length; i += frameSize) {
                const left = channels[0].subarray(i, i + frameSize);
                const right = channels[1] ? channels[1].subarray(i, i + frameSize) : left; // モノラルなら右も左と同じ
                const mp3buf = mp3Encoder.encodeBuffer(left, right);
                if (mp3buf.length > 0) {
                    mp3Data.push(mp3buf);
                }
            }

            // 最後のフレームをフラッシュ
            const mp3buf = mp3Encoder.flush();
            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }

            // Blobを作成してダウンロード
            const blob = new Blob(mp3Data, { type: 'audio/mp3' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'mml_music.mp3';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            statusMessage.textContent = 'MP3ファイルを保存しました！';

        } catch (error) {
            console.error('MP3エクスポートエラー:', error);
            statusMessage.textContent = `MP3保存中にエラーが発生しました: ${error.message}`;
        } finally {
            isExporting = false;
            exportBtn.textContent = 'MP3に保存';
            exportBtn.disabled = false;
            playBtn.disabled = false;
            stopBtn.disabled = true; // 再生中ではないので停止は無効
        }
    });

    // 初期状態のボタン制御
    playBtn.disabled = true; // FlMML初期化後に有効化
    stopBtn.disabled = true;
    exportBtn.disabled = true; // FlMML初期化後に有効化
    statusMessage.textContent = 'MMLプレイヤーを準備中...';
});
