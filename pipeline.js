class Pipeline {
    constructor(blocks, executionContext) {
        this.pipeline = blocks
        this.pipeline.context = executionContext
    }
}