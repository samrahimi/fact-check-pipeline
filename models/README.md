# TextFlow

TextFlow is a flexible and powerful AI pipeline framework designed for creating complex, multi-step AI workflows. Built out of frustration with the limitations of existing frameworks like Langchain, TextFlow offers a more customizable and efficient approach to AI task orchestration.

## Features

- **Modular Design**: Easily compose complex workflows from reusable, configurable blocks.
- **Model Agnostic**: Support for multiple AI model vendors, including Mistral, Google, Perplexity, and OpenRouter.
- **Customizable Prompts**: Fine-grained control over AI behavior with customizable system and user prompts for each step.
- **Structured Data Handling**: Built-in support for JSON input/output, maintaining data structure throughout the pipeline.
- **Integrated Fact-Checking**: Built-in steps for fact-checking and research to maintain accuracy in AI-generated content.
- **First class support for Perplexity**: Use Perplexity Sonar online models the same way you'd use any other model, and build research teams that turn weeks of work into just a few hours
- **Flexible handling of JSON output**: For models that lack native json_object output support, just set the output type to json_object in your block, and give an example of the schema in your prompt, and the pipeline runner will parse out any json code block it finds
- **Uncensored Capabilities**: Designed to handle uncensored content for applications where content filtering might be too restrictive.
- **Flexible Step Types**: Supports various step types including standard inference, mapping, reducing, and custom tools.

## Getting Started

To use TextFlow, you'll need to define your pipeline steps in a JSON configuration file. Here's a basic example:

```json
{
  "pipeline_name": "simple_pipeline",
  "steps": [
    {
      "name": "generate_content",
      "type": "standard_inference",
      "config": {
        "model_vendor": "mistral_openai",
        "model_id": "mistral-large-latest",
        "system_prompt": "You are a helpful assistant.",
        "user_prompt": "{userRequest}",
        "output_key": "generated_content"
      }
    },
    {
      "name": "fact_check",
      "type": "mapper",
      "config": {
        "model_vendor": "perplexity",
        "model_id": "llama-3.1-sonar-huge-128k-online",
        "system_prompt": "You are a fact-checker. Verify the following claim.",
        "user_prompt": "Claim to check: {task}",
        "input_key": "generated_content",
        "tasks_key": "claims",
        "output_key": "fact_check_results"
      }
    }
  ]
}
```

## Documentation

For more detailed information on how to use TextFlow, including all available step types and configuration options, please refer to our comprehensive documentation (coming soon).

## Contributing

We welcome contributions to TextFlow! Please feel free to submit issues, feature requests, or pull requests.

## License

TextFlow is released under the MIT License. See the LICENSE file for more details.

## Acknowledgements

TextFlow was born out of the need for a more flexible and powerful AI pipeline framework. We acknowledge the inspiration provided by existing frameworks and the valuable lessons learned from their limitations.

---

Happy TextFlowing! 🌊✨