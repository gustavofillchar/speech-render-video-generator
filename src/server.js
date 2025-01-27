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

// Função para verificar se um arquivo é um vídeo
function isVideo(filename) {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv'];
    const ext = path.extname(filename).toLowerCase();
    return videoExtensions.includes(ext);
}

// Função para obter a duração de um arquivo de mídia
const getMediaDuration = (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) reject(err);
            resolve(metadata.format.duration);
        });
    });
};

// Função para processar o áudio em etapas
const processAudio = async (backgroundPath, narrationPath, outputPath, totalDuration) => {
    // Primeiro, adiciona o delay à narração
    const delayedNarrationPath = path.join(uploadsDir, `delayed_${Date.now()}.mp3`);
    
    await new Promise((resolve, reject) => {
        ffmpeg()
            .input(narrationPath)
            .audioFilters(`adelay=5000|5000`)
            .duration(totalDuration)
            .on('error', reject)
            .on('end', resolve)
            .save(delayedNarrationPath);
    });

    // Depois, combina os áudios com volume ajustado
    await new Promise((resolve, reject) => {
        ffmpeg()
            .input(backgroundPath)
            .inputOptions(['-stream_loop -1'])
            .input(delayedNarrationPath)
            .complexFilter([
                '[0:a]volume=0.2[background]',
                '[background][1:a]amix=inputs=2:duration=first'
            ])
            .duration(totalDuration)
            .on('error', (err) => {
                fs.unlinkSync(delayedNarrationPath);
                reject(err);
            })
            .on('end', () => {
                fs.unlinkSync(delayedNarrationPath);
                resolve();
            })
            .save(outputPath);
    });
};

app.post('/upload', async (req, res) => {
    const tempFiles = [];
    try {
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
        }

        // Gera nomes únicos para os arquivos
        const timestamp = Date.now();
        const backgroundTrackPath = path.join(uploadsDir, `background_${timestamp}.mp3`);
        const narrationPath = path.join(uploadsDir, `narration_${timestamp}.mp3`);
        const coverMediaPath = path.join(uploadsDir, `cover_${timestamp}${path.extname(req.files.coverMedia.name)}`);
        const outputPath = path.join(uploadsDir, `output_${timestamp}.mp4`);
        const combinedAudioPath = path.join(uploadsDir, `combined_${timestamp}.mp3`);

        tempFiles.push(
            backgroundTrackPath,
            narrationPath,
            coverMediaPath,
            combinedAudioPath
        );

        console.log('Movendo arquivos enviados...');
        await req.files.backgroundTrack.mv(backgroundTrackPath);
        await req.files.narration.mv(narrationPath);
        await req.files.coverMedia.mv(coverMediaPath);

        console.log('Obtendo duração da narração...');
        const narrationDuration = await getMediaDuration(narrationPath);
        const totalDuration = narrationDuration + 10; // 5 segundos antes + 5 segundos depois

        console.log('Processando áudio...');
        await processAudio(backgroundTrackPath, narrationPath, combinedAudioPath, totalDuration);

        console.log('Processando vídeo/imagem...');
        if (isVideo(coverMediaPath)) {
            console.log('Arquivo é um vídeo, processando...');
            await new Promise((resolve, reject) => {
                ffmpeg()
                    .input(coverMediaPath)
                    .inputOptions(['-stream_loop -1'])
                    .input(combinedAudioPath)
                    .outputOptions([
                        '-c:v libx264',
                        '-preset medium',
                        '-tune film',
                        '-c:a aac',
                        '-b:a 192k',
                        '-pix_fmt yuv420p',
                        '-movflags +faststart',
                        `-t ${totalDuration}`
                    ])
                    .output(outputPath)
                    .on('start', (commandLine) => {
                        console.log('Comando FFmpeg:', commandLine);
                    })
                    .on('progress', (progress) => {
                        console.log('Progresso:', progress);
                    })
                    .on('end', () => {
                        console.log('Processamento de vídeo concluído');
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error('Erro no processamento do vídeo:', err);
                        reject(err);
                    })
                    .run();
            });
        } else {
            console.log('Arquivo é uma imagem, processando...');
            await new Promise((resolve, reject) => {
                ffmpeg()
                    .input(coverMediaPath)
                    .inputOptions(['-loop 1'])
                    .input(combinedAudioPath)
                    .outputOptions([
                        '-c:v libx264',
                        '-tune stillimage',
                        '-c:a aac',
                        '-b:a 192k',
                        '-pix_fmt yuv420p',
                        '-movflags +faststart',
                        `-t ${totalDuration}`
                    ])
                    .output(outputPath)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });
        }

        console.log('Limpando arquivos temporários...');
        tempFiles.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });

        console.log('Processo concluído com sucesso');
        const videoUrl = `/uploads/output_${timestamp}.mp4`;
        res.json({ videoUrl });

    } catch (error) {
        console.error('Erro detalhado:', error);
        console.error('Stack trace:', error.stack);
        
        tempFiles.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
        
        res.status(500).json({ error: 'Erro ao processar os arquivos: ' + error.message });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
}); 