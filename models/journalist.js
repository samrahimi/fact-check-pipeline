const load = () => {return {
  "pipeline_name": "long_form_documents",
  "steps": [{name: "planning", type: "standard_inference", config:
    {
      "temperature": 0.85, 
     "response_format": "json_object",
     "model_vendor": "mistral_openai",
     "model_id": "mistral-large-latest",
     "max_tokens": 1024,
     output_key: "plan",
     "system_prompt": "You are a senior project manager for the investigative journalism dept, New York Times Magazine. Your job is to take an idea for a story, and transform it into a project plan so that our reporter can deliver a detailed, convincing article supported by our research team and fact checkers.",
     "user_prompt": "Thinking step by step, first consider the client request, refine the client request into a project description that clearly specifies the big picture objectives and nature of the investigation we are working on, and return a project plan as JSON {original_client_request, project_description, task_descriptions[]}. The task_descriptions should each be a string that clearly instructs one of our research analysts on what we need. Each Task Description should be clear, focused, and stand on its own, without depending on other tasks. Tasks should be scoped so that each task can be completed by a research analyst working alone, without the need to consult with other researchers or the PM. Your plan should contain between 3 and 5 tasks depending on the complexity of the project\n\n---\n\nPROJECT IDEA: {userRequest}"
   }}
   ,
   {name: "research", type: "mapper", config:
    {
     "temperature": 0.72,
     "model_vendor": "openrouter",
     "model_id": "perplexity/llama-3.1-sonar-large-128k-online",
     "input_key": "plan",
     "tasks_key": "task_descriptions",
     "output_key": "research",
     "system_prompt": "You are a senior research analyst for the investigative journalism team at the New York Times magazine. You are part of a team who supports the investigative reporter by researching specific areas related to a project. Please do thorough and diligent research as you complete your task and summarize what you learned clearly and professionally. Consider the overall goals of the project but perform only the tasks that are assigned to you. Always include plaintext list of works cited at the end, each item should be simply: Article Title. Publication Name. URL.",
     "user_prompt": "Overall Project Goal: {project_description}\n\nCurrent Task: {task}\n\nOutput Format: Make sure that what you say can be supported by the sources that you cite. List the sources used including URL, at the end of your response"
   }},
   {
    "name": "compile_research",
    "type": "reducer",
    "config": {
      "input_key": "research",
      "output_key": "compiled_research",
      "reduce_function": "concatenate",
      "include_task_prompts": true,
      "task_prompt_prefix": "**Research Task:** ",
      "task_response_prefix": "",
      "delimiter": "\n---\n"
    }
  },

   {name: "delivery", type: "standard_inference", config:
    {
    "temperature": 0.9,
    "max_tokens": 8192,
     "model_vendor": "google",
     "model_id": "gemini-1.5-pro-exp-0827",
     "system_prompt": "You are a celebrated investigative journalist who writes long-form, detailed, and often shocking stories that bring the truth to light and are fascinating to read",
     "user_prompt": "Research Reports:\n\n{compiled_research}\n\n---\n\n{userRequest} ({project_description})\n\nPlease write a highly detailed and descriptive article, based on the context. Write at least 4500 words"
   }}]

}}

module.exports={load}
