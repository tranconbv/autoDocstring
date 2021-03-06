import * as path from "path";
import * as vs from "vscode";
import { DocstringFactory } from "./docstring/docstring_factory";
import { getCustomTemplate, getTemplate } from "./docstring/get_template";
import { getDocstringIndentation, parse } from "./parse";

export class AutoDocstring {

    private editor: vs.TextEditor;

    constructor(editor: vs.TextEditor) {
        this.editor = editor;
    }

    public generateDocstring(hook = "" ): Thenable<boolean> {
        const document = this.editor.document.getText();
        const position = this.editor.selection.active;

        const docstringSnippet = this.generateDocstringSnippet(document, position,hook);
        const insertPosition = position.with(undefined, 0);
        return this.editor.insertSnippet(docstringSnippet, insertPosition);
    }

    private generateDocstringSnippet(document: string, position: vs.Position,hook:string): vs.SnippetString {
        const config = this.getConfig();

        const docstringFactory = new DocstringFactory(
            this.getTemplate(),
            config.get("quoteStyle").toString(),
            config.get("startOnNewLine") === true,
            config.get("includeExtendedSummary") === true,
            config.get("includeName") === true,
            config.get("guessTypes") === true,
        );

        const docstringParts = parse(document, position.line,hook);
        const indentation = getDocstringIndentation(document, position.line);
        const docstring = docstringFactory.generateDocstring(docstringParts, indentation);

        return new vs.SnippetString(docstring);
    }

    private getTemplate(): string {
        const config = this.getConfig();
        let customTemplatePath = config.get("customTemplatePath").toString();

        if (customTemplatePath === "") {
            const docstringFormat = config.get("docstringFormat").toString();
            return getTemplate(docstringFormat);
        }

        if (!path.isAbsolute(customTemplatePath)) {
            customTemplatePath = path.join(vs.workspace.rootPath, customTemplatePath);
        }

        try {
            return getCustomTemplate(customTemplatePath);
        } catch (err) {
            const errorMessage = "AutoDocstring Error: Template could not be found: " + customTemplatePath;
            vs.window.showErrorMessage(errorMessage);
        }
    }

    private getConfig(): vs.WorkspaceConfiguration {
        return vs.workspace.getConfiguration("autoDocstring");
    }
}
