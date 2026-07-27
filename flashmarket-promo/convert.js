const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const webmPath = path.join(__dirname, 'flashmarket-promo.webm');
const mp4Path = path.join(__dirname, 'flashmarket-promo.mp4');

if (!fs.existsSync(webmPath)) {
    console.log('\x1b[31m%s\x1b[0m', '--------------------------------------------------------------');
    console.log('\x1b[31m%s\x1b[0m', 'Erreur: Le fichier "flashmarket-promo.webm" est introuvable.');
    console.log('\x1b[31m%s\x1b[0m', '--------------------------------------------------------------');
    console.log('Étape à suivre :');
    console.log('1. Allez sur http://localhost:3000');
    console.log('2. Cliquez sur le bouton noir "Enregistrer la Vidéo 🎥" en bas à droite');
    console.log('3. Sélectionnez l\'onglet de votre navigateur et lancez l\'enregistrement');
    console.log('4. Une fois l\'enregistrement terminé, le fichier "flashmarket-promo.webm" se téléchargera.');
    console.log(`5. Déplacez ce fichier dans le dossier : "${__dirname}"`);
    console.log('6. Relancez cette commande : node convert.js\n');
    process.exit(1);
}

console.log('\x1b[32m%s\x1b[0m', 'Configuration du convertisseur (cette étape ne se produit qu\'une fois)...');

try {
    const tempDir = path.join(__dirname, '.ffmpeg-temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    
    const ffmpegModulePath = path.join(tempDir, 'node_modules', 'ffmpeg-static');
    if (!fs.existsSync(ffmpegModulePath)) {
        fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'temp-ffmpeg' }));
        console.log('Téléchargement de FFmpeg de manière sécurisée...');
        execSync('npm install ffmpeg-static', { cwd: tempDir, stdio: 'inherit' });
    }
    
    // Require the package from the local temp node_modules
    const ffmpegStatic = require(ffmpegModulePath);
    
    console.log('\x1b[32m%s\x1b[0m', '\nConversion du fichier WebM en MP4 Ultra Haute Qualité (H.264/AAC)...');
    
    // Run conversion
    execSync(`"${ffmpegStatic}" -y -i "${webmPath}" -c:v libx264 -crf 15 -preset slow -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:a aac -b:a 192k "${mp4Path}"`, {
        stdio: 'inherit'
    });
    
    console.log('\n\x1b[32m%s\x1b[0m', '==============================================================');
    console.log('\x1b[32m%s\x1b[0m', 'SUCCÈS ! Votre vidéo a été convertie avec succès.');
    console.log('\x1b[32m%s\x1b[0m', `Fichier MP4 généré : ${mp4Path}`);
    console.log('\x1b[32m%s\x1b[0m', '==============================================================');
    console.log('Vous pouvez maintenant l\'uploader directement sur TikTok, Reels, Shorts !');
} catch (error) {
    console.error('\n\x1b[31m%s\x1b[0m', 'Erreur lors de la conversion :');
    console.error(error.message);
}
