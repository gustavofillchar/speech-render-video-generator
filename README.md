# Gerador de Vídeo com Áudio

Esta aplicação permite combinar uma trilha de áudio, uma narração e uma imagem para criar um vídeo MP4.

## Pré-requisitos

- Node.js (versão 14 ou superior)
- FFmpeg instalado no sistema

### Instalando FFmpeg

- **macOS** (usando Homebrew):
  ```bash
  brew install ffmpeg
  ```

- **Ubuntu/Debian**:
  ```bash
  sudo apt update
  sudo apt install ffmpeg
  ```

- **Windows**:
  1. Baixe o FFmpeg de https://ffmpeg.org/download.html
  2. Extraia os arquivos
  3. Adicione o caminho da pasta bin ao PATH do sistema

## Instalação

1. Clone o repositório ou baixe os arquivos
2. Instale as dependências:
   ```bash
   npm install
   ```

## Uso

1. Inicie o servidor:
   ```bash
   npm start
   ```

2. Abra o navegador e acesse `http://localhost:3000`

3. Na interface web:
   - Faça upload da trilha de áudio principal
   - Faça upload do arquivo de narração
   - Faça upload da imagem de capa
   - Clique em "Gerar Vídeo"

4. Aguarde o processamento e faça o download do vídeo gerado

## Funcionalidades

- A trilha de áudio principal começa imediatamente
- A narração é inserida após 5 segundos do início
- 5 segundos de silêncio são adicionados após o término da narração
- A imagem é usada como plano de fundo do vídeo
- O vídeo final é gerado em formato MP4

## Limitações

- Tamanho máximo de arquivo: 50MB
- Formatos suportados:
  - Áudio: MP3, WAV, M4A
  - Imagem: JPG, PNG 