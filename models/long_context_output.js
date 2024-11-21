const load = () => {
    return {
      "pipeline_name": "long_form_content",
      "steps": [
        {
          "name": "planning",
          "type": "standard_inference",
          "description": "Planning content structure...",
          "config": {
            "response_format": "json_object",
            "temperature": 0.8,
            "model_vendor": "mistral_openai",
            "model_id": "mistral-large-latest",
            "system_prompt": `You are a skilled content planner with expertise in various forms of long-form content such as books, articles, reports, and scripts. Your role is to create detailed, engaging outlines based on the user's request.`,
            "user_prompt": `Create a comprehensive outline for the requested long-form content. 
  
            Return ONLY JSON in this format: 
            {
              content_title, 
              project_description, 
              section_descriptions: ['Section 1: A sentence about this section', 'Section 2: ...', etc]
            }.
  
            Each section description should provide clear instructions for what to write, in conjunction with the project description. Adjust the number of sections based on the content type and complexity.
  
            Content Request: {userRequest}`,
            "input_key": "userRequest",
            "output_key": "content_plan",
            "output_to_client": true,
            "output_to_display": true,
            "max_tokens": 2048,
            "json_stdout_override": true,
          },
        },
        {
          "name": "content_creation",
          "type": "mapper",
          "description": "Creating content...",
          "config": {
            "temperature": 0.9,
            "model_vendor": "google",
            "model_id": "gemini-1.5-pro-exp-0827",
            "max_tokens": 8192,
            "system_prompt": "You are a versatile content creator skilled in writing various forms of long-form content. Adapt your writing style to suit the specific content type and target audience. Focus on creating engaging, well-structured, and informative content.",
            "user_prompt": `Write the following section of the content: {task}
  
            Ensure your writing aligns with the overall structure and tone of the project. Aim for approximately 1000-1500 words per section, adjusting as needed for the content type.`,
            "user_grounding_context": `Content Request: {userRequest}
  
            Content Plan: {content_plan}
  
            ---`,
            "input_key": "content_plan",
            "tasks_key": "section_descriptions",
            "output_key": "completed_sections",
            "output_to_client": true,
            "output_to_display": true,
            "DEBUG": true
          }
        }
      ]
    }
  }
  
  module.exports = { load }