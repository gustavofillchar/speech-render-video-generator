const express = require('express');
const fileUpload = require('express-fileupload');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Configuração dos middlewares
app.use(express.static('public'));
app.use(fileUpload({
    createParentPath: true,
    limits: { fileSize: 50 * 1024 * 1024 } // limite de 50MB
}));

// Pasta para armazenar arquivos temporários
const uploadsDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/index.html'));
});

app.post('/upload', async (req, res) => {
    try {
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
        }

        // Gera nomes únicos para os arquivos
        const timestamp = Date.now();
        const backgroundTrackPath = path.join(uploadsDir, `background_${timestamp}.mp3`);
        const narrationPath = path.join(uploadsDir, `narration_${timestamp}.mp3`);
        const imagePath = path.join(uploadsDir, `cover_${timestamp}.jpg`);
        const outputPath = path.join(uploadsDir, `output_${timestamp}.mp4`);
        const combinedAudioPath = path.join(uploadsDir, `combined_${timestamp}.mp3`);

        // Move os arquivos enviados para a pasta de uploads
        await req.files.backgroundTrack.mv(backgroundTrackPath);
        await req.files.narration.mv(narrationPath);
        await req.files.coverImage.mv(imagePath);

        // Primeiro, vamos obter a duração do arquivo de narração
        const getNarrationDuration = () => {
            return new Promise((resolve, reject) => {
                ffmpeg.ffprobe(narrationPath, (err, metadata) => {
                    if (err) reject(err);
                    resolve(metadata.format.duration);
                });
            });
        };

        const narrationDuration = await getNarrationDuration();
        const totalDuration = narrationDuration + 10; // 5 segundos antes + 5 segundos depois

        // Combina os áudios com o delay especificado
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(backgroundTrackPath)
                .inputOptions(['-stream_loop -1']) // Loop na música de fundo
                .input(narrationPath)
                .complexFilter([
                    // Adiciona 5 segundos de silêncio no início da narração
                    '[1:a]adelay=5000|5000[delayed_narration]',
                    // Ajusta o volume da música de fundo para 20%
                    '[0:a]volume=0.2[background]',
                    // Combina a trilha de fundo com a narração atrasada
                    '[background][delayed_narration]amix=inputs=2:duration=first[audio]',
                    // Adiciona 5 segundos de silêncio no final
                    '[audio]apad=pad_dur=5[final_audio]'
                ])
                .map('[final_audio]')
                .duration(totalDuration)
                .save(combinedAudioPath)
                .on('end', resolve)
                .on('error', reject);
        });

        // Cria o vídeo final combinando a imagem com o áudio
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(imagePath)
                .inputOptions(['-loop 1', `-t ${totalDuration}`]) // Define a duração da imagem
                .input(combinedAudioPath)
                .outputOptions([
                    '-c:v libx264',
                    '-tune stillimage',
                    '-c:a aac',
                    '-b:a 192k',
                    '-pix_fmt yuv420p',
                    '-movflags +faststart'
                ])
                .output(outputPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        // Limpa os arquivos temporários
        fs.unlinkSync(backgroundTrackPath);
        fs.unlinkSync(narrationPath);
        fs.unlinkSync(combinedAudioPath);

        // Retorna o URL para download do vídeo
        const videoUrl = `/uploads/output_${timestamp}.mp4`;
        res.json({ videoUrl });

    } catch (error) {
        console.error('Erro:', error);
        res.status(500).json({ error: 'Erro ao processar os arquivos' });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
}); 