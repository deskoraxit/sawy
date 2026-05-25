
// --- Spanish forced description (100% always ES) ---
function __getESDescription(photo, query){
  try{
    const base = query || "manicura";
    return `Imagen de ${base} con manos y uñas cuidadas`;
  }catch(e){
    return "Imagen de manicura";
  }
}

export * from '../pages.js';
