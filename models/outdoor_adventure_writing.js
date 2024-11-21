// ./models/adventure_sport.js
const load = () => {
    return {
      "pipeline_name": "outdoor_adventure_writing",
      "description": "Writes long-form journalistic pieces on adventures, explorations, extreme sports, etc. Uses multiple research bots to find material for the writer to use",
      "input" : "A text prompt with the idea for the story",
      "output": "The finished article",
      "steps": [
        {
          "name": "planning",
          "description": "Transforms a story idea into a detailed project plan with research tasks.",
          "type": "standard_inference",
          "config": {
            "temperature": 0.7,
            "response_format": "json_object",
            "model_vendor": "mistral_openai",
            "model_id": "mistral-large-latest",
            "max_tokens": 2048,
            "system_prompt": "You are the senior editor for an acclaimed adventure and outdoor sports magazine. Your job is to take a story idea and transform it into an epic narrative journey. Focus on creating a plan that will uncover not just facts, but also human drama, environmental challenges, and the raw essence of adventure. Think in terms of story arcs, character development, and vivid scene-setting.",
            "user_prompt": "Thinking step by step, first consider the client's request, refine the client's request into a project description that clearly specifies the overall objectives and nature of the story we're working on, and return a project plan as JSON {original_client_request, project_description, task_descriptions[]}. The task descriptions should each be a string that clearly indicates to one of our research analysts what we need. Each task description should be clear, focused, and independent, not relying on other tasks. Tasks should be scoped such that each task can be completed by a research analyst working alone, without the need to consult with other researchers or the PM. Your plan should contain between 3 and 5 tasks depending on the complexity of the project\n\n---\n\nPROJECT IDEA: {userRequest}",
            "input_key": "userRequest",
            "output_key": "project_plan"
          }
        },
        {
          "name": "research",
          "description": "Conducts in-depth research based on the tasks defined in the project plan.",
          "type": "mapper",
          "config": {
            "temperature": 0.66,
            "max_tokens": 4096,
            "model_vendor": "perplexity",
            "model_id": "llama-3.1-sonar-small-128k-online",
            "system_prompt": "You are an adventurous researcher for a prestigious outdoor and sports magazine. Your mission is to uncover captivating details, personal stories, and little-known facts that will bring our feature stories to life. Don't just stick to dry facts - seek out the human element, the environmental context, and the pulse-pounding moments of adventure. Use a mix of official sources, personal accounts, and historical records to paint a vivid picture.",
            "user_prompt": `Overall project objective: {project_description}\n\nCurrent task: {task}\n\nProvide your findings in a detailed, captivating narrative style, as if you're recounting the most interesting parts of your research journey. Include direct quotes where possible, and vivid descriptions of people, places, and events.
            
            Use the following format:

            ### <research task>
            Findings: <the learnings from your research>
            Sources:
            1. <source info>. <source URL>
            ...
            
             `,
            "input_key": "project_plan",
            "tasks_key": "task_descriptions",
            "output_key": "research_results"
          }
        },
        {
          "name": "compile_research",
          "type": "reducer",
          "config": {
            "input_key": "research_results",
            "output_key": "compiled_research",
            "reduce_function": "concatenate",
            "include_task_prompts": true,
            "task_prompt_prefix": "**Research Task:** ",
            "task_response_prefix": "",
            "delimiter": "\n---\n"
          }
        },
        {
          "name": "article_writing",
          "description": "Generates a captivating long-form article based on the research findings.",
          "type": "standard_inference",
          "config": {
            "temperature": 0.9,
            "max_tokens": 8192,
             "model_vendor": "openrouter",
             "model_id": "openai/chatgpt-4o-latest",
            "system_prompt": "You are a celebrated adventure journalist known for your gripping, immersive long-form articles. Your writing transports readers to the heart of the action, whether it's the icy slopes of Everest or the depths of the ocean. Blend factual reporting with narrative storytelling, creating a piece that informs, entertains, and moves the reader. Focus on building tension, developing characters, and vividly describing the environment and the challenges faced.",
            "user_prompt": "Research Context: \n\n{compiled_research}\n\n---\n\nProject Description: {project_description}\n\nPlease write a very detailed and descriptive article on the topic using the context provided by our research team, the knowledge you learned from training, and your amazing ability to understand how it all connects. Your story should be at least 4000 words in length. Include a catchy # headline and ## subheadings to break up the text. Begin with a gripping hook and end with a powerful conclusion that resonates with the theme of your story. Don't forget to sprinkle in direct quotes and vivid sensory details throughout.",
            "input_key": "compiled_research",
            "output_key": "final_article"
          }
        }
      ]
    };
  };
  
  module.exports = { load };
  