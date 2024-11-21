const load = () => {
    return {
      "pipeline_name": "code_generation_web_dev",
      "steps": [
        {
          "name": "project_planning",
          "type": "standard_inference",
          "description": "Planning project structure...",
          "config": {
            "response_format": "json_object",
            "temperature": 0.7,
            "model_vendor": "mistral_openai",
            "model_id": "mistral-large-latest",
            "system_prompt": `You are an experienced software architect and web developer. Your role is to create detailed project plans based on the user's requirements, outlining the necessary files, classes, or components for the project.`,
            "user_prompt": `Create a comprehensive project plan for the requested web development or coding project. 
  
            Return ONLY JSON in this format: 
            {
              project_name,
              project_description,
              tech_stack: ['Technology 1', 'Technology 2', ...],
              structure: [
                {
                  name: 'ComponentOrFileName1',
                  type: 'file/class/component',
                  description: 'Purpose and functionality of this item',
                  dependencies: ['Dependency1', 'Dependency2', ...]
                },
                // ... more items
              ]
            }
  
            Ensure that the structure covers all necessary parts of the project, including backend and frontend components if applicable. Adjust the number of items based on the project's complexity.
  
            Project Request: {userRequest}`,
            "input_key": "userRequest",
            "output_key": "project_plan",
            "output_to_client": true,
            "output_to_display": true,
            "max_tokens": 2048,
            "json_stdout_override": true,
          },
        },
        {
          "name": "code_generation",
          "type": "mapper",
          "description": "Generating code...",
          "config": {
            "temperature": 0.2,
            "model_vendor": "google",
            "model_id": "gemini-1.5-pro-exp-0827",
            "max_tokens": 8192,
            "system_prompt": "You are an expert programmer with deep knowledge of various programming languages, frameworks, and best practices in software development and web technologies. Your task is to generate high-quality, well-documented code based on the provided project plan.",
            "user_prompt": `Generate the code for the following component of the project: {task}
  
            Ensure your code follows best practices, is well-commented, and aligns with the overall project structure and chosen tech stack. Include any necessary import statements or dependencies.
  
            If this component interacts with other parts of the project, briefly explain how it fits into the larger system.`,
            "user_grounding_context": `Project Request: {userRequest}
  
            Project Plan: {project_plan}
  
            ---`,
            "input_key": "project_plan",
            "tasks_key": "structure",
            "output_key": "generated_code",
            "output_to_client": true,
            "output_to_display": true,
            "DEBUG": true
          }
        }
      ]
    }
  }
  
  module.exports = { load }