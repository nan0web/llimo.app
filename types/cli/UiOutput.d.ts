export class UiOutput {
    toString(): string;
    /** @param {import("./Ui.js").Ui} ui */
    renderIn(ui: import("./Ui.js").Ui): void;
}
