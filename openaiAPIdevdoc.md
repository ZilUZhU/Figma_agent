**Developer Guide: Mastering the OpenAI API with JavaScript (Node.js) - GPT-4o & Responses API**

This guide provides a comprehensive walkthrough of interacting with the OpenAI API using the official `openai` Node.js library, focusing on the latest `Responses` API and the `gpt-4o` model family. We'll cover text generation, image analysis, structured outputs, tool usage (function calling, web search, file search), streaming, conversation management, and best practices.

**Table of Contents**

1.  **Introduction:** The OpenAI API & the `Responses` Endpoint
2.  **Prerequisites**
3.  **Installation**
4.  **Authentication**
5.  **Core Concepts**
    - Models (GPT-4o, GPT-4o Mini)
    - The `Responses` API Structure (`input`, `output`, `instructions`)
    - Message Roles (`user`, `assistant`, `developer`)
    - Tokens & Context Window
6.  **Basic Operations with `responses.create`**
    - Simple Text Generation
    - Image Analysis (Vision Capabilities)
7.  **Advanced Text Generation & Prompting**
    - Using High-Level `instructions`
    - Leveraging Message Roles for Nuance
    - Choosing Between Models (GPT-4o vs. Mini)
    - Effective Prompt Engineering Principles
8.  **Structured Outputs (Reliable JSON)**
    - Introduction & Benefits
    - Defining and Using `json_schema` format
    - Comparison with Legacy JSON Mode
    - Supported Models & Schema Constraints
    - Handling Refusals
    - Use Cases (Chain-of-Thought, Data Extraction)
9.  **Extending Capabilities with Tools**
    - Overview: Giving Models External Power
    - **Function Calling:**
      - Defining Custom Functions (Schema)
      - Step 1: Initial API Call with Tool Definition
      - Step 2: Handling `function_call` Output from Model
      - Step 3: Executing Your Function Code
      - Step 4: Sending Results Back to the Model
      - Step 5: Receiving the Final Response
      - Strict Mode (`strict: true`) & Schema Requirements
      - Tool Choice (`auto`, `required`, specific function)
      - Parallel Function Calling
      - Best Practices for Function Definitions
    - **Built-in Tool: Web Search (`web_search_preview`)**
      - Enabling Web Search
      - Output Structure & Citations (`web_search_call`, `url_citation`)
      - Customizing User Location
      - Controlling Search Context Size (`low`, `medium`, `high`)
    - **Built-in Tool: File Search**
      - Overview & Prerequisites (Vector Stores)
      - Enabling File Search (`vector_store_ids`)
      - Output Structure & Citations (`file_search_call`, `file_citation`)
      - Customization (Max Results, Including Results, Metadata Filtering)
      - Supported File Types & Limitations
10. **Streaming Responses (Server-Sent Events)**
    - Enabling Streaming (`stream: true`)
    - Understanding Semantic Events (Event Types)
    - Handling Different Event Deltas (Text, Function Args, Refusals)
    - Aggregating Streamed Data
11. **Managing Conversation State**
    - Manual State Management (Passing Full History)
    - Using `previous_response_id` and `store: true`
    - Understanding and Managing the Context Window
12. **Building Agent-like Behavior (Conceptual)**
13. **Error Handling**
    - API Errors (`APIError`)
    - Handling Refusals and Incomplete Responses
    - Rate Limits (`429`)
14. **Best Practices**
15. **Further Resources**

---

**1. Introduction: The OpenAI API & the `Responses` Endpoint**

The OpenAI API grants access to cutting-edge AI models like GPT-4o for tasks including text generation, image understanding, code creation, and more. The modern **`Responses API` (`client.responses.create`)** provides a unified and flexible interface for interacting with these models, handling various input types (text, images), managing tools, and enabling features like structured outputs and streaming. It's designed to be simpler and more powerful than older endpoints like Chat Completions for many use cases.

---

**2. Prerequisites**

- **Node.js:** Version 18 or later is recommended.
- **npm or yarn:** Node.js package manager.
- **OpenAI Account & API Key:** Sign up at [platform.openai.com](https://platform.openai.com/) and obtain your API key from your account settings.
- **Basic JavaScript/TypeScript:** Understanding `async`/`await` is essential.

---

**3. Installation**

Install the official OpenAI Node.js library:

```bash
# Using npm
npm install openai

# Using yarn
yarn add openai
```

---

**4. Authentication**

Securely provide your API key. The recommended method is using environment variables:

```bash
export OPENAI_API_KEY='your-api-key-here'
# Or for Windows (Command Prompt): set OPENAI_API_KEY=your-api-key-here
# Or for Windows (PowerShell): $env:OPENAI_API_KEY="your-api-key-here"
```

The library automatically detects this variable. Alternatively, initialize the client directly (less secure, avoid committing keys):

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "your-api-key-here", // Defaults to process.env.OPENAI_API_KEY
});
```

---

**5. Core Concepts**

- **Models:**
  - `gpt-4o`: The flagship model offering a strong balance of intelligence, speed, cost, and multimodal (text/image) capabilities. Excellent for complex reasoning, creativity, and understanding.
  - `gpt-4o-mini`: A smaller, faster, and cheaper version, still highly capable, especially suitable for simpler tasks, high-volume applications, or when fine-tuned.
  - _Reasoning Models (e.g., `o1` series):_ Specialized for complex tasks requiring internal chain-of-thought, potentially slower/more expensive than GPT models.
- **The `Responses` API Structure:**
  - `input`: The primary prompt or conversation history. Can be a simple string or an array of message objects (or image URLs).
  - `output`: An array containing the model's response items (e.g., messages, function calls, search results). The `output_text` convenience property aggregates text outputs.
  - `instructions`: A high-level parameter to guide the model's overall behavior, tone, or goals, taking precedence over the `input` prompt if conflicting.
- **Message Roles:** When using the `input` array for multi-turn conversations or specific instructions:
  - `developer`: Instructions from the application developer, weighted highest. Use for system-level directives or persona setting.
  - `user`: Input from the end-user.
  - `assistant`: Previous responses generated by the model. Used to maintain conversation history.
  - _(Tool-related roles like `function_call` and `function_call_output` are covered later)._
- **Tokens & Context Window:**
  - Text is broken into tokens (roughly words/subwords). API usage is billed per token.
  - The **Context Window** is the maximum total tokens (input + output + potential reasoning tokens for some models) allowed in a single request chain. `gpt-4o` has a large 128k context window. Exceeding this limit can lead to truncated outputs. Use the [Tokenizer tool](https://platform.openai.com/tokenizer) to estimate token counts.

---

**6. Basic Operations with `responses.create`**

**6.1 Simple Text Generation**

```javascript
import OpenAI from "openai";
const client = new OpenAI();

async function generateText() {
  try {
    const response = await client.responses.create({
      model: "gpt-4o", // Or "gpt-4o-mini"
      input: "Write a one-sentence bedtime story about a brave astronaut.",
      // 'store: true' can be added to save the response for conversation chaining
    });

    // Access the aggregated text output
    console.log("Generated Text:", response.output_text);

    // Or access the raw output array
    // console.log("Raw Output:", JSON.stringify(response.output, null, 2));
    /* Example Raw Output Structure:
    [
      {
        "id": "msg_...",
        "type": "message",
        "role": "assistant",
        "content": [
          {
            "type": "output_text",
            "text": "Starlight the astronaut zipped past shimmering nebulas, waving hello to sleepy moonbeams on her way back to Earth.",
            "annotations": []
          }
        ]
      }
    ]
    */
  } catch (error) {
    console.error("Error generating text:", error);
  }
}

generateText();
```

**6.2 Image Analysis (Vision Capabilities)**

Provide image URLs within the `input` array alongside text prompts.

```javascript
import OpenAI from "openai";
const client = new OpenAI();

async function analyzeImage() {
  try {
    const response = await client.responses.create({
      model: "gpt-4o", // GPT-4o has strong vision capabilities
      input: [
        // You can mix text and image inputs
        {
          role: "user",
          content: "Describe the main action happening in this image.",
        },
        {
          role: "user", // Images are typically provided under the 'user' role
          content: [
            {
              type: "input_image",
              image_url:
                "https://upload.wikimedia.org/wikipedia/commons/3/3b/LeBron_James_Layup_%28Cleveland_vs_Brooklyn_2018%29.jpg",
              // You can also provide base64 encoded images:
              // type: "input_image_base64",
              // image_base64: "data:image/jpeg;base64,/9j/..."
            },
          ],
        },
        { role: "user", content: "What teams might be playing?" },
      ],
    });

    console.log("Image Analysis:", response.output_text);
  } catch (error) {
    console.error("Error analyzing image:", error);
  }
}

analyzeImage();
```

---

**7. Advanced Text Generation & Prompting**

**7.1 Using High-Level `instructions`**

Set the overall behavior or persona using the `instructions` parameter.

```javascript
import OpenAI from "openai";
const client = new OpenAI();

async function pirateResponse() {
  try {
    const response = await client.responses.create({
      model: "gpt-4o",
      instructions: "Talk like a cheerful pirate, matey! Keep it brief.",
      input: "Explain the benefits of using version control like Git.",
    });
    console.log("Pirate Explanation:", response.output_text);
  } catch (error) {
    console.error("Error:", error);
  }
}

pirateResponse(); // Output: "Aye, Git be treasure! It tracks yer code changes..."
```

**7.2 Leveraging Message Roles for Nuance**

Use the `input` array with roles for more structured guidance or multi-turn conversations. The `developer` role has higher priority than `user`.

```javascript
import OpenAI from "openai";
const client = new OpenAI();

async function structuredGuidance() {
  try {
    const response = await client.responses.create({
      model: "gpt-4o",
      input: [
        {
          role: "developer", // Higher priority instruction
          content: "Act as a senior software architect. Be concise.",
        },
        {
          role: "user", // The user's query
          content:
            "Should we use microservices or a monolith for our new e-commerce startup?",
        },
        // You could include past 'assistant' messages here for conversation history
      ],
    });
    console.log("Architect Advice:", response.output_text);
  } catch (error) {
    console.error("Error:", error);
  }
}

structuredGuidance();
```

**7.3 Choosing Between Models (GPT-4o vs. Mini)**

- **`gpt-4o`:** Best for complex reasoning, nuanced understanding, high-quality creative generation, image analysis, and tasks requiring broad knowledge. Use when quality and capability are paramount.
- **`gpt-4o-mini`:** Excellent for faster responses, lower costs, simpler tasks, chatbots, summarization, classification, and when fine-tuned for specific domains. Use when speed and cost-efficiency are priorities, and the task isn't overly complex.

**7.4 Effective Prompt Engineering Principles**

- **Be Specific & Detailed:** Clearly state the desired format, tone, length, and constraints. Avoid ambiguity.
- **Provide Context:** Include relevant background information within the `input` or `instructions`.
- **Use Roles Effectively:** Assign appropriate roles (`developer`, `user`, `assistant`) to guide the conversation flow and instruction priority.
- **Few-Shot Learning:** Provide examples of desired input/output pairs within the prompt (often in the `developer` or initial `user` message) to demonstrate the expected behavior.
- **Goal-Oriented (for Reasoning Models):** Describe the task in terms of goals and outcomes rather than strict step-by-step instructions.
- **Iterate and Evaluate:** Test your prompts with realistic data. Use evaluations (evals) to measure performance and refine prompts based on results.

---

**8. Structured Outputs (Reliable JSON)**

Ensure the model's output strictly adheres to a specified JSON schema. This is invaluable for predictable data extraction and integration with other systems.

**8.1 Introduction & Benefits**

- **Reliability:** Guarantees valid JSON conforming to your schema.
- **Type Safety:** Avoids validating/retrying malformed responses.
- **Explicit Refusals:** Safety refusals are clearly indicated.
- **Simpler Prompting:** Reduces the need for complex "output in JSON" instructions.

**8.2 Defining and Using `json_schema` format**

Provide the schema within the `text.format` parameter.

```javascript
import OpenAI from "openai";
const openai = new OpenAI();

async function extractEventData() {
  try {
    const response = await openai.responses.create({
      model: "gpt-4o", // Or specific snapshots like gpt-4o-2024-08-06
      input: [
        {
          role: "developer",
          content:
            "Extract key calendar event details from the user's message.",
        },
        {
          role: "user",
          content:
            "Let's schedule a team sync for next Tuesday at 3 PM regarding the Q3 roadmap.",
        },
      ],
      text: {
        // Specify the desired text output format
        format: {
          type: "json_schema", // Use structured outputs
          name: "calendar_event", // A descriptive name for the schema
          schema: {
            // Define the JSON schema
            type: "object",
            properties: {
              event_name: {
                type: "string",
                description: "A concise name for the event.",
              },
              date: {
                type: "string",
                description:
                  "The date of the event (e.g., YYYY-MM-DD or relative like 'next Tuesday').",
              },
              time: {
                type: "string",
                description: "The time of the event (e.g., 3 PM).",
              },
              topic: {
                type: ["string", "null"],
                description: "The main topic, if mentioned.",
              }, // Example of optional field using null type
            },
            required: ["event_name", "date", "time", "topic"], // All properties must be listed here (use null type for optional)
            additionalProperties: false, // Crucial: Must be false for structured outputs
          },
          strict: true, // Recommended: Enforces stricter adherence (requires specific schema properties like additionalProperties: false)
        },
      },
    });

    // The output_text will be a JSON string conforming to the schema
    console.log("Raw JSON Output:", response.output_text);

    // Parse the JSON string
    const eventData = JSON.parse(response.output_text);
    console.log("Parsed Event Data:", eventData);
  } catch (error) {
    console.error("Error getting structured output:", error);
  }
}

extractEventData();
```

**8.3 Comparison with Legacy JSON Mode**

| Feature            | Structured Outputs (`json_schema`)              | JSON Mode (`json_object`)                   |
| :----------------- | :---------------------------------------------- | :------------------------------------------ |
| Outputs Valid JSON | Yes                                             | Yes                                         |
| Adheres to Schema  | **Yes** (within supported schema features)      | **No** (only guarantees valid JSON syntax)  |
| Compatible Models  | `gpt-4o`, `gpt-4o-mini` (check specific dates)  | Most `gpt-3.5-turbo`, `gpt-4`, `gpt-4o`     |
| Enabling           | `text: { format: { type: "json_schema", ... }}` | `text: { format: { type: "json_object" } }` |
| Recommendation     | **Preferred** when available                    | Fallback for older models                   |

**Key Difference:** Structured Outputs _validates against your schema_, while JSON Mode only ensures the _syntax_ is correct JSON. Always prefer Structured Outputs if your model supports it.

**8.4 Supported Models & Schema Constraints**

- **Supported Models:** Check the official docs for the latest list (e.g., `gpt-4o-2024-08-06`, `gpt-4o-mini-2024-07-18` and later).
- **Schema Constraints:**
  - Supported types: `string`, `number`, `boolean`, `integer`, `object`, `array`, `enum`, `anyOf`.
  - Root must be `object`. `anyOf` not allowed at the root.
  - **All fields must be `required`**. Use `type: ["string", "null"]` for optional fields.
  - `additionalProperties: false` is **mandatory** for all objects.
  - Limits on nesting depth (5), total properties (100), enum values (500), total string lengths in schema definitions.
  - Some keywords (`minLength`, `pattern`, `minimum`, etc.) are not supported.
  - Definitions (`$defs`) and recursion (`$ref: "#"`) are supported.
  - Output key order matches schema order.

**8.5 Handling Refusals**

If the model refuses the request for safety reasons, the output structure changes. Check for a `refusal` type.

```javascript
// Assuming 'response' is the result from responses.create with json_schema
const firstOutputItem = response.output[0];

if (
  firstOutputItem.type === "message" &&
  firstOutputItem.content[0]?.type === "refusal"
) {
  console.warn(
    "Model refused the request:",
    firstOutputItem.content[0].refusal
  );
  // Handle the refusal appropriately in your UI or logic
} else if (response.output_text) {
  try {
    const parsedData = JSON.parse(response.output_text);
    console.log("Parsed Data:", parsedData);
    // Process the valid structured data
  } catch (parseError) {
    console.error(
      "Failed to parse JSON output:",
      parseError,
      response.output_text
    );
  }
} else {
  console.log("Unexpected response structure:", response.output);
}
```

**8.6 Use Cases**

- **Data Extraction:** Pulling structured info from unstructured text (emails, articles).
- **Chain-of-Thought:** Forcing the model to output reasoning steps in a structured way (e.g., math tutoring).
- **API Integration:** Generating payloads for other APIs.
- **UI Generation:** Creating structured data to dynamically render UI components.

---

**9. Extending Capabilities with Tools**

Give the model access to external data or actions (your code, web search, file search).

**9.1 Overview**

You define available tools. The model decides if/when to use a tool based on the input. If it does, it outputs a request to call the tool. Your code executes the tool and sends the results back for the model to generate the final answer.

**9.2 Function Calling**

Connect the model to your custom JavaScript functions.

- **Defining Custom Functions:** Provide a JSON schema describing the function's name, purpose, parameters, and whether to use strict mode.

  ```javascript
  // 1. Define the JSON Schema for the tool
  const tools = [
    {
      type: "function", // Tool type is 'function'
      name: "getCurrentWeather", // Your JS function name
      description:
        "Get the current temperature for a given location in Celsius.",
      strict: true, // Recommended: Enable strict schema adherence
      parameters: {
        // JSON schema for arguments
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The city and state/country, e.g., Paris, France",
          },
          // Example optional param using null type (needed for strict mode)
          unit: {
            type: ["string", "null"],
            enum: ["celsius", "fahrenheit"],
            description: "Temperature unit. Defaults to celsius if null.",
          },
        },
        required: ["location", "unit"], // List all params here for strict mode
        additionalProperties: false, // Required for strict mode
      },
    },
  ];

  // 2. Implement the actual JavaScript function
  async function getCurrentWeather({ location, unit }) {
    console.log(
      `---> Calling external weather API for ${location} in ${
        unit ?? "celsius"
      }...`
    );
    // --- In a real app, make an API call here ---
    // Mock response:
    const temp = location.toLowerCase().includes("paris") ? 14 : 22;
    const actualUnit = unit ?? "celsius"; // Default to celsius
    return JSON.stringify({ temperature: temp, unit: actualUnit }); // Must return a string
  }

  // Map function names to actual functions for execution
  const availableFunctions = {
    getCurrentWeather: getCurrentWeather,
  };
  ```

- **Function Calling Flow (Illustrated by the Diagram):**

  1.  **Developer Sends Request:** Call `responses.create` with `input` messages and the `tools` array containing function definitions.

      ```javascript
      // Step 1: Call model with tool definition
      async function initialCall() {
        const inputMessages = [
          { role: "user", content: "What's the weather like in Paris today?" },
        ];
        const response = await client.responses.create({
          model: "gpt-4o",
          input: inputMessages,
          tools: tools, // Provide the defined tools
          tool_choice: "auto", // Let the model decide ("required" forces tool use)
          store: true, // Store response for chaining
        });
        console.log("Step 1 Response Output:", response.output);
        await handleFunctionCalls(response, inputMessages); // Move to next step
      }
      ```

  2.  **Model Requests Tool Call:** If the model decides to use a function, the `response.output` will contain an item with `type: "function_call"`, including `name`, `arguments` (as a JSON string), and a `call_id`.

      ```json
      // Example response.output[0] from Step 1
      {
        "type": "function_call",
        "id": "fc_123...", // Unique ID for this call instance in the output array
        "call_id": "call_abc...", // Unique ID for the entire call sequence
        "name": "getCurrentWeather",
        "arguments": "{\"location\":\"Paris, France\",\"unit\":null}" // Arguments as JSON string
      }
      ```

  3.  **Developer Executes Function:** Your code parses the `arguments`, finds the corresponding JS function (using `availableFunctions` map), executes it, and gets the result (must be a string).

      ```javascript
      // Part of handleFunctionCalls function
      async function handleFunctionCalls(response, history) {
        let requiresFollowUp = false;
        for (const outputItem of response.output) {
          if (outputItem.type === "function_call") {
            requiresFollowUp = true;
            const toolCall = outputItem;
            const functionName = toolCall.name;
            const functionToCall = availableFunctions[functionName];
            const args = JSON.parse(toolCall.arguments);

            console.log(
              `---> Executing function: ${functionName}(${JSON.stringify(
                args
              )})`
            );
            // Step 3: Execute your function
            const result = await functionToCall(args); // Await if async
            console.log(`<--- Function result: ${result}`);

            // Append the function result to the history for the next call
            history.push({
              type: "function_call_output", // Indicate this is function output
              call_id: toolCall.call_id, // Link to the specific call
              output: result, // The string result from your function
            });
          } else if (outputItem.type === "message") {
            // If the first response was a direct message, log it
            if (!requiresFollowUp)
              console.log(
                "Final Response (No Tool Call):",
                outputItem.content[0]?.text
              );
          }
        }
        // If any function was called, proceed to Step 4
        if (requiresFollowUp) {
          await followUpCall(history);
        }
      }
      ```

  4.  **Developer Sends Results Back:** Make a _second_ call to `responses.create`, passing the _entire conversation history_ (original input + the model's `function_call` output + your `function_call_output` results).

      ```javascript
      // Step 4: Send results back to the model
      async function followUpCall(history) {
        console.log("--- Sending results back to model ---");
        const finalResponse = await client.responses.create({
          model: "gpt-4o",
          input: history, // Include all prior messages and tool results
          tools: tools, // Provide tools again in case of chained calls
          // store: true, // Optional: store this final step
        });
        console.log("Step 5: Final Model Response:", finalResponse.output_text);
      }
      ```

  5.  **Model Provides Final Response:** The model processes the function results and generates a final, user-facing response incorporating that information.

- **Strict Mode (`strict: true`):** Highly recommended. Ensures function arguments reliably match the schema. Requires `additionalProperties: false` and all properties listed in `required` (use `["string", "null"]` for optional). Introduces minor latency on first use due to schema processing/caching.
- **Tool Choice:**
  - `"auto"` (default): Model decides whether to call functions.
  - `"required"`: Forces the model to call _at least one_ function.
  - `{"type": "function", "name": "your_function_name"}`: Forces the model to call _that specific_ function.
  - `"none"`: Prevents the model from calling any functions.
- **Parallel Function Calling:** By default (`parallel_tool_calls: true` or omitted), the model might request multiple function calls simultaneously in step 2. Set `parallel_tool_calls: false` to limit it to zero or one call per turn. _Note: Strict mode may be disabled for parallel calls._
- **Best Practices:** Write clear, detailed function/parameter descriptions. Use the `instructions` or `developer` message to guide _when_ to use functions. Keep function logic clear and return concise results (strings). Offload logic to code where possible. Aim for fewer, well-defined functions (<20 is a guideline).

**9.3 Built-in Tool: Web Search (`web_search_preview`)**

Allow the model to access up-to-date information from the internet.

- **Enabling:** Add `{ type: "web_search_preview" }` to the `tools` array.

  ```javascript
  import OpenAI from "openai";
  const client = new OpenAI();

  async function searchWeb() {
    try {
      const response = await client.responses.create({
        model: "gpt-4o",
        tools: [
          {
            type: "web_search_preview",
            // Optional configurations:
            // user_location: { type: "approximate", country: "US", city: "New York", timezone: "America/New_York" },
            // search_context_size: "medium" // "low", "medium", "high" (default: medium)
          },
        ],
        // tool_choice: {type: "web_search_preview"}, // Optional: Force web search
        input: "What are some major tech news headlines from today?",
      });

      console.log("Web Search Response:", response.output_text);
      // Look for annotations in the raw output for citations
      console.log("Raw Output:", JSON.stringify(response.output, null, 2));
    } catch (error) {
      console.error("Error using web search:", error);
    }
  }
  searchWeb();
  ```

- **Output & Citations:** The `response.output` will contain:
  - A `web_search_call` item indicating the search happened.
  - A `message` item where the `output_text` content includes inline citations (e.g., `[1]`). The `annotations` array within the message content provides details (`url_citation`) for each citation (URL, title, start/end index). **You must display these citations clearly in your UI.**
- **User Location:** Provide approximate location (`country`, `city`, `region`, `timezone`) within the tool definition to get geographically relevant results.
- **Search Context Size:** Control the amount of web data retrieved (`low`, `medium`, `high`). Higher context generally means better quality but higher cost and latency. This token usage is separate from the main model's context window and bill.

**9.4 Built-in Tool: File Search**

Enable the model to search through content uploaded to OpenAI Vector Stores.

- **Overview & Prerequisites:** You first need to:
  1.  Create a Vector Store using the API ([Vector Stores Guide](https://platform.openai.com/docs/guides/retrieval/vector-stores)).
  2.  Upload files to that Vector Store ([Upload Files Guide](https://platform.openai.com/docs/guides/retrieval/uploading-files)).
      _(These steps typically use separate API endpoints like `client.beta.vectorStores.create()` and `client.files.create()` / `client.beta.vectorStores.files.create()`)_.
- **Enabling:** Add `{ type: "file_search", vector_store_ids: ["your_vector_store_id"] }` to the `tools` array. Currently searches one store at a time.

  ```javascript
  import OpenAI from "openai";
  const openai = new OpenAI();

  // Assume vectorStoreId is obtained after creating a store and adding files
  const vectorStoreId = "vs_xxxxxxxxxxxxxxxxxxxx"; // Replace with your actual ID

  async function searchFiles() {
    if (!vectorStoreId.startsWith("vs_")) {
      console.error("Please replace placeholder vectorStoreId.");
      return;
    }
    try {
      const response = await openai.responses.create({
        model: "gpt-4o", // Or gpt-4o-mini
        input: "Summarize the key findings from the Q3 research report.",
        tools: [
          {
            type: "file_search",
            vector_store_ids: [vectorStoreId], // ID of the store to search
            // Optional customization:
            // max_num_results: 5,
            // filters: { type: "eq", key: "document_type", value: "report" } // Example metadata filter
          },
        ],
        // include: ["file_search_call.results"], // Optional: Include raw search results in output
      });

      console.log("File Search Response:", response.output_text);
      // Check raw output for citations
      console.log("Raw Output:", JSON.stringify(response.output, null, 2));
    } catch (error) {
      console.error("Error using file search:", error);
    }
  }
  searchFiles();
  ```

- **Output & Citations:** The `response.output` includes:
  - A `file_search_call` item.
  - A `message` item where `output_text` content has inline citations. The `annotations` array contains `file_citation` objects (file ID, filename, index).
- **Customization:**
  - `max_num_results`: Limit the number of retrieved chunks.
  - `include: ["file_search_call.results"]`: Add raw search result details to the `file_search_call` output item.
  - `filters`: Apply filters based on metadata you attached to files during upload (refer to Retrieval guide).
- **Supported Files & Limitations:** Supports common text, code, document (.pdf, .docx), and presentation (.pptx) formats. Limits apply to total storage (100GB/project), files per store (10k), and individual file size (512MB).

---

**10. Streaming Responses (Server-Sent Events)**

Receive the model's response incrementally as it's generated, ideal for real-time UIs.

- **Enabling:** Set `stream: true` in the `responses.create` call.

- **Understanding Semantic Events:** The API streams typed events. You process these events in a loop. Key event types include:

  - `response.created`, `response.in_progress`, `response.completed`, `response.failed`: Lifecycle events.
  - `response.output_item.added`, `response.output_item.done`: Indicate the start and end of an output item (like a message or function call).
  - `response.output_text.delta`: Contains the next chunk of generated text content.
  - `response.output_text_annotation.added`: Contains citation information.
  - `response.refusal.delta`, `response.refusal.done`: Stream refusal messages.
  - `response.function_call_arguments.delta`, `response.function_call_arguments.done`: Stream function call arguments incrementally.
  - `response.file_search_call.in_progress`, `response.web_search_call.in_progress`, etc.: Events specific to tool progress.
  - `error`: Indicates an error occurred during streaming.

- **Handling Events & Aggregating Deltas:**

  ```javascript
  import { OpenAI } from "openai";
  const client = new OpenAI();
  
  async function streamResponse() {
    try {
      const stream = await client.responses.create({
        model: "gpt-4o",
        input: [
          { role: "user", content: "Write a short poem about streaming data." },
        ],
        stream: true,
        // You can also stream responses involving tools
        // tools: tools,
        // text: { format: { type: "json_schema", ... } } // Can also stream structured outputs
      });
  
      let fullTextResponse = "";
      let currentFunctionCall = { name: null, arguments: "" }; // Example for handling function call stream
  
      console.log("Streaming Response:");
  
      for await (const event of stream) {
        // console.log("Event:", event.type); // Log event type for debugging
  
        switch (event.type) {
          case "response.output_text.delta":
            const textDelta = event.delta;
            fullTextResponse += textDelta;
            process.stdout.write(textDelta); // Print text delta immediately
            break;
  
          case "response.output_item.added":
            // If a function call starts
            if (event.item?.type === "function_call") {
              currentFunctionCall = { name: event.item.name, arguments: "" };
              console.log(`\n[Function Call Started: ${event.item.name}]`);
            }
            break;
  
          case "response.function_call_arguments.delta":
            // Accumulate function arguments
            currentFunctionCall.arguments += event.delta;
            process.stdout.write(event.delta); // Show arguments streaming
            break;
  
          case "response.function_call_arguments.done":
            console.log(
              `\n[Function Call Arguments Complete: ${currentFunctionCall.arguments}]`
            );
            // Here you would potentially parse currentFunctionCall.arguments and prepare for execution
            break;
  
          case "response.refusal.delta":
            console.warn(`\n[Refusal Chunk: ${event.delta}]`);
            break;
  
          case "response.completed":
            console.log("\n--- Stream Completed ---");
            // Process the final aggregated response or function calls
            // console.log("Final Aggregated Text:", fullTextResponse);
            break;
  
          case "error":
            console.error("\n--- Stream Error ---", event.error);
            break;
  
          // Add cases for other event types as needed (e.g., citations, tool progress)
        }
      }
    } catch (error) {
      console.error("Error setting up stream:", error);
    }
  }
  
  streamResponse();
  ```

---

**11. Managing Conversation State**

OpenAI API calls are inherently stateless (unless using Assistants API). You need to manage context between turns.

- **Manual State Management:** Maintain an array of message objects (`developer`, `user`, `assistant`, `function_call`, `function_call_output`) representing the entire conversation history. Pass this full array as the `input` on each subsequent `responses.create` call. This gives you full control but requires careful management.

  ```javascript
  // (Illustrative - see function calling example for a practical implementation)
  let conversationHistory = [{ role: "user", content: "What is React?" }];

  // First call
  const response1 = await client.responses.create({
    model: "gpt-4o-mini",
    input: conversationHistory,
  });
  // Add assistant response to history
  conversationHistory.push({
    role: "assistant",
    content: response1.output_text,
  }); // Simplified

  // Ask follow-up
  conversationHistory.push({
    role: "user",
    content: "How is it different from Angular?",
  });
  const response2 = await client.responses.create({
    model: "gpt-4o-mini",
    input: conversationHistory,
  });
  console.log(response2.output_text);
  ```

- **Using `previous_response_id` and `store: true`:**

  - Set `store: true` in your `responses.create` call. This tells OpenAI to save the context associated with the response.
  - For the _next_ turn, provide the `id` of the _previous_ response in the `previous_response_id` parameter. You only need to include the _new_ messages/tool outputs in the `input` array for this turn.
  - OpenAI automatically chains the context. **Note:** You are still billed for all tokens in the _entire chain_, even those not explicitly passed in the current request's `input`.

  ```javascript
  import OpenAI from "openai";
  const openai = new OpenAI();

  async function chainedConversation() {
    // First turn
    const response1 = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [{ role: "user", content: "Tell me a short space joke." }],
      store: true, // Store this response's context
    });
    console.log("Joke:", response1.output_text);
    const response1Id = response1.id; // Get the ID for chaining

    // Second turn - only provide the new input and the previous ID
    const response2 = await openai.responses.create({
      model: "gpt-4o-mini",
      previous_response_id: response1Id, // Link to the previous response
      input: [{ role: "user", content: "Explain why that joke is funny." }],
      store: true, // Store this one too if chaining further
    });
    console.log("Explanation:", response2.output_text);
  }
  chainedConversation();
  ```

- **Managing the Context Window:** As conversations grow (especially with manual history), the total token count increases.
  - Monitor token usage (`response.usage`).
  - If approaching the model's limit (e.g., 128k for `gpt-4o`), implement strategies like:
    - Summarizing earlier parts of the conversation.
    - Pruning older messages.
    - Using embeddings and vector search for relevant context retrieval instead of passing the full history.
  - Exceeding the limit results in errors or truncated input/output.

---

**12. Building Agent-like Behavior (Conceptual)**

The tools and state management techniques described above are the building blocks for creating "agents" – AI systems that can perform multi-step tasks, use tools interactively, and potentially control external systems.

While the provided Python example uses a specific `Agent SDK`, the core concepts in JavaScript involve:

- **Looping:** Repeatedly calling the model, checking for tool calls, executing them, and feeding results back.
- **Planning:** Designing prompts (`instructions` or `developer` messages) that encourage the model to break down complex tasks.
- **State Management:** Persistently storing conversation history and task status between API calls.
- **Tool Orchestration:** Deciding which tool to call when, potentially based on model output or explicit logic.

Building robust agents requires careful design of the control loop, prompt engineering, and error handling around the `responses.create` calls and tool executions.

---

**13. Error Handling**

Your application must gracefully handle potential issues.

- **API Errors (`APIError`):** Wrap API calls in `try...catch`. The `openai` library throws specific error types.

  ```javascript
  import OpenAI, { APIError } from "openai";
  const client = new OpenAI();

  try {
    const response = await client.responses.create({
      /* ... */
    });
    // Process response... check for refusals/incomplete below
  } catch (error) {
    if (error instanceof APIError) {
      console.error(
        `OpenAI API Error: Status ${error.status}, Type: ${error.type}, Message: ${error.message}`
      );
      // Handle specific codes: 401 (auth), 429 (rate limit), 400 (bad request), 5xx (server issues)
    } else {
      console.error("Non-API Error:", error);
    }
  }
  ```

- **Handling Refusals and Incomplete Responses:** Even if the API call succeeds (200 OK), the model might refuse or fail to complete.
  - Check `response.output[0].content[0].type === "refusal"` (as shown in Structured Outputs).
  - Check `response.status` (e.g., `"incomplete"`) and `response.incomplete_details.reason` (e.g., `"max_output_tokens"`, `"content_filter"`) for partial responses, especially when using legacy JSON Mode or if output exceeds limits.
- **Rate Limits (`429`):** Implement exponential backoff and retry logic when you hit rate limits (requests/minute, tokens/minute).

---

**14. Best Practices**

- **Security:** Use environment variables or secure secret managers for API keys. Never commit keys.
- **Cost:** Monitor token usage (`response.usage`) in the OpenAI dashboard. Use `gpt-4o-mini` for simpler tasks. Be mindful of tool costs (e.g., web search context size).
- **Prompting:** Be clear, specific, and provide context/examples. Iterate based on results.
- **Function Design:** Clear names/descriptions. Use `strict: true`. Return concise string results.
- **Context Management:** Actively manage conversation history to stay within token limits. Use `previous_response_id` or summarization/pruning.
- **Error Handling:** Implement robust error handling for API errors, refusals, incomplete responses, and rate limits.
- **Streaming:** Use for interactive applications to improve perceived performance.
- **Structured Outputs:** Prefer `json_schema` over `json_object` for reliable JSON when available.

---

**15. Further Resources**

- **OpenAI API Reference:** [https://platform.openai.com/docs/api-reference/responses](https://platform.openai.com/docs/api-reference/responses)
- **OpenAI Documentation Guides:** [https://platform.openai.com/docs/guides](https://platform.openai.com/docs/guides)
  - Function Calling: [https://platform.openai.com/docs/guides/function-calling](https://platform.openai.com/docs/guides/function-calling)
  - Structured Outputs: [https://platform.openai.com/docs/guides/structured-outputs](https://platform.openai.com/docs/guides/structured-outputs)
  - Web Search: [https://platform.openai.com/docs/guides/tools-web-search](https://platform.openai.com/docs/guides/tools-web-search)
  - File Search / Retrieval: [https://platform.openai.com/docs/guides/retrieval](https://platform.openai.com/docs/guides/retrieval)
  - Conversation State: [https://platform.openai.com/docs/guides/conversation-state](https://platform.openai.com/docs/guides/conversation-state)
  - Streaming: [https://platform.openai.com/docs/guides/streaming](https://platform.openai.com/docs/guides/streaming)
- **Models:** [https://platform.openai.com/docs/models](https://platform.openai.com/docs/models)
- **OpenAI Cookbook (Examples):** [https://cookbook.openai.com/](https://cookbook.openai.com/)
- **OpenAI Node.js Library (GitHub):** [https://github.com/openai/openai-node](https://github.com/openai/openai-node)

---
