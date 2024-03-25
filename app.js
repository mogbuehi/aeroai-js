require('dotenv').config();
const axios = require('axios');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// Import prompts
function importTextFileSync(filePath) {
    try {
        // Ensure the path is correct, especially if running from a different directory
        const absolutePath = path.resolve(filePath);
        const data = fs.readFileSync(absolutePath, { encoding: 'utf8' });
        return data;
    } catch (error) {
        console.error(`Error reading file: ${error.message}`);
        return null;
    }
}


//-----------------------------------------------------------------------------------
// Function to create an assistant and upload files
async function createAssistant() {
    const apiKey = process.env.OPENAI_API_KEY; // Make sure to have your API key in an .env file or set as an environment variable

    const filePath = 'prompt.txt'; // Path to your .txt file
    const fileContent = importTextFileSync(filePath);
    console.log(fileContent);

    const assistantData = {
        "name": "CBTA Instructor", // Name your assistant
        "instructions": "", // Provide a description for your assistant
        // Specify other properties as needed, following the OpenAI API documentation
    };

    try {
        const response = await axios.post('https://api.openai.com/v1/assistants', assistantData, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const assistantId = response.data.id; // Extract the assistant ID from the response
        console.log(`Assistant Created. ID: ${assistantId}`);
        return assistantId;
    } catch (error) {
        console.error(`Error creating assistant: ${error.response ? error.response.data : error.message}`);
    }
}

// Function to upload PDF files to the assistant
async function createAssistantFile(assistantId, fileContent) {
    const apiKey = process.env.OPENAI_API_KEY;

    // Assuming 'fileContent' is the content you want to upload as the assistant file
    // For example, a JSON string with prompts and completions for training the assistant

    try {
        const formData = new FormData();
        formData.append('file', fileContent, 'file.json'); // Append the file content; ensure the content type and file name are correct

        const response = await axios.post(`https://api.openai.com/v1/assistants/${assistantId}/files`, formData, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'multipart/form-data'
            }
        });

        console.log(`File created for Assistant ID: ${assistantId}`);
        return response.data; // Returns the created file's details
    } catch (error) {
        console.error(`Error uploading file to assistant: ${error.response ? error.response.data : error.message}`);
    }
}

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const { textToJson, pdfGen, appendPdf } = require('./pdfUtils'); // Assuming pdfUtils.js exports these functions

const sleep = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitOnRun(run, threadId) {
    const apiKey = process.env.OPENAI_API_KEY;
    while (run.status === "queued" || run.status === "in_progress") {
        const response = await axios.get(`https://api.openai.com/v1/beta/threads/runs/${threadId}/${run.id}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        run = response.data;
        await sleep(500);
    }
    return run;
}

async function getResponse(threadId) {
    const apiKey = process.env.OPENAI_API_KEY;
    const response = await axios.get(`https://api.openai.com/v1/beta/threads/messages?thread_id=${threadId}&order=desc`, {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });
    return response.data;
}

function prettyPrint(messages) {
    console.log("# Messages");
    messages.forEach(m => {
        console.log(`${m.role}: ${m.content[0].text.value}`);
    });
    console.log();
}

async function aiAssistant(userInput, threadId, assistantId) {
    const apiKey = process.env.OPENAI_API_KEY;
    let message = await axios.post(`https://api.openai.com/v1/beta/threads/messages`, {
        thread_id: threadId,
        role: "user",
        content: userInput
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });

    let run = await axios.post(`https://api.openai.com/v1/beta/threads/runs`, {
        thread_id: threadId,
        assistant_id: assistantId
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });

    run = await waitOnRun(run.data, threadId);

    const messages = await getResponse(threadId);

    const aiMessage = messages.data[0].content[0].text.value;
    const convo = `Time: ${new Date().toISOString()}\nUser: ${userInput}\n\nAI: ${aiMessage}\n\nThread_ID: ${threadId}`;
    
    // Additional logic for handling the conversation and PDF generation as needed

    return aiMessage;
}

async function pdfAgent(convoInput, threadId, assistantId) {
    const apiKey = process.env.OPENAI_API_KEY;
    let message = await axios.post(`https://api.openai.com/v1/beta/threads/messages`, {
        thread_id: threadId,
        role: "user",
        content: convoInput
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });

    let run = await axios.post(`https://api.openai.com/v1/beta/threads/runs`, {
        thread_id: threadId,
        assistant_id: assistantId
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });

    run = await waitOnRun(run.data, threadId);

    const messages = await getResponse(threadId);

    const aiMessage = messages.data[0].content[0].text.value;
    const convo = `Time: ${new Date().toISOString()}\nUser: ${userInput}\n\nAI: ${aiMessage}\n\nThread_ID: ${threadId}`;
    
    // Additional logic for handling the conversation and PDF generation as needed

    return aiMessage;
}

// Example usage
(async () => {
    const threadId = 'your_thread_id_here'; // This needs to be obtained or set according to your logic
    const userInput = 'Your user input here';
    const aiResponse = await aiAssistant(userInput, threadId);
    console.log(aiResponse);
    // Additional code for PDF Agent if needed
})();


//--------------------------------------------------------------------------------------
// Functions used to create PPT like PDF files (easier to manipulate than PPT files)
async function textToJson(pptText) {
    const apiKey = process.env.OPENAI_API_KEY;
    const response = await axios.post('https://api.openai.com/v1/completions', {
        model: "gpt-3.5-turbo",
        prompt: pptText,
        max_tokens: 100,
        n: 1,
        stop: null,
        temperature: 0.5,
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        }
    });

    console.log(response.data.choices[0].text); // Debugging
    return JSON.parse(response.data.choices[0].text);
}

async function createPdfFromJson(jsonData, pdfPath = 'presentation.pdf') {
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);

    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const fontSize = 24;
    page.drawText(jsonData.title || ' ', {
        x: 50,
        y: height - 4 * fontSize,
        size: fontSize,
        font: timesRomanFont,
        color: rgb(0, 0, 0),
    });

    jsonData.paragraph.forEach((paragraph, index) => {
        page.drawText(paragraph, {
            x: 50,
            y: height - (6 + index * 2) * fontSize,
            size: 12,
            font: timesRomanFont,
            color: rgb(0, 0, 0),
        });
    });

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(pdfPath, pdfBytes);
}

// Example usage
textToJson('Your PowerPoint text here').then(jsonData => {
    createPdfFromJson(jsonData);
});

//-----------------------------------------------------------------------------------
// Generating Audio Response
// Simulate getting a response from the assistant
async function simulateAssistantResponse(userInput, threadId) {
    // Assuming aiAssistant is a previously defined function that fetches a response
    const textResponse = await aiAssistant(userInput, threadId);
    return textResponse;
  }
app.get('/response', async (req, res) => {
    const userInput = req.query.userInput; // Or however you obtain the user input
    const threadId = "your_thread_id"; // This should be dynamically obtained as per your application logic
    const textResponse = await simulateAssistantResponse(userInput, threadId);

    // Append to session or state management solution
    // Display in the user interface
    res.send(`Assistant says: ${textResponse}`);
    });

  