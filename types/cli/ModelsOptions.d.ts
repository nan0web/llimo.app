export class ModelsOptions {
    static filter: {
        help: string;
        default: string;
    };
    static help: {
        alias: string;
        help: string;
        default: boolean;
    };
    constructor(input?: {});
    filter: string;
    help: boolean;
    /**
     * @returns {Array<(model: ModelInfo) => boolean>}
     */
    getFilters(): Array<(model: ModelInfo) => boolean>;
}
import { ModelInfo } from "../llm/ModelInfo.js";
