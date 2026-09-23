export const uploadToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  
  // Acá va exactamente el nombre que creaste
  formData.append("upload_preset", "trazo_evidencia"); 
  
  // Acordate de reemplazar ACA_VA_TU_CLOUD_NAME por el tuyo real
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/r98hvvpf/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Error al subir imagen");
  
  return data.secure_url; 
};