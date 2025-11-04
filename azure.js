const endpoint = "https://artte-mhasln5q-eastus2.cognitiveservices.azure.com/"//"https://harder.openai.azure.com/";
const deploymentName = "gpt-5-mini"; // your deployment name

const response = await fetch(`${endpoint}openai/deployments/${deploymentName}/chat/completions?api-version=2025-08-07`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "api-key": apiKey,
  },
  body: JSON.stringify({
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello! What's the weather today?" }
    ],
  }),
});

const data = await response.json();
console.log(data)
console.log(data.choices[0].message.content);
