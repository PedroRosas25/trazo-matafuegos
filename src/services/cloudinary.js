export const uploadToCloudinary = async (file, folderPath = 'Trazo/General', metadatos = '') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'trazo_evidencia'); // Recordá mantener el tuyo
  formData.append('folder', folderPath);
  
  // Si le mandamos metadatos, los inyecta en la foto
  if (metadatos) {
    formData.append('context', metadatos);
  }

  try {
    const res = await fetch('https://api.cloudinary.com/v1_1/r98hvvpf/image/upload', { // Recordá mantener tu cloud_name
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    return data.secure_url;
  } catch (error) {
    console.error('Error subiendo a Cloudinary:', error);
    throw error;
  }
};