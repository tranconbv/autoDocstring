import { guessType } from ".";
import { Argument, Decorator, DocstringParts, Exception, KeywordArgument, Returns, Yields } from "../docstring_parts";
import * as vs from "vscode";
import {existsSync } from "fs";







export function parseParameters(parameterTokens: string[], body: string[], functionName: string): DocstringParts {
    return {
        name: functionName,
        decorators: parseDecorators(parameterTokens),
        args: parseArguments(parameterTokens,functionName),
        kwargs: parseKeywordArguments(parameterTokens),
        returns: parseReturn(parameterTokens, body),
        yields: parseYields(parameterTokens, body),
        exceptions: parseExceptions(body),
    };
}

function parseDecorators(parameters: string[]): Decorator[] {
    const decorators: Decorator[] = [];
    const pattern = /^@(\w+)/;

    for (const param of parameters) {
        const match = param.trim().match(pattern);

        if (match == undefined) {
            continue;
        }

        decorators.push({
            name: match[1],
        });
    }

    return decorators;
}

function parseArguments(parameters: string[],functionName: string): Argument[] {
    const fs = require('fs');
    const boxwiseFunctionsFile = vs.workspace.getConfiguration("autoDocstring").get("boxwiseFunctions").toString()
    const args: Argument[] = [];
    const excludedArgs = ["self", "cls","base"];
    const pattern = /^(\w+)/;
    let boxwiseFunction = false;
    let functionVariables = []
    if(boxwiseFunctionsFile !== "")
    {
        if (existsSync(boxwiseFunctionsFile)) 
        {
            let rawdata = fs.readFileSync(boxwiseFunctionsFile);
            let data = JSON.parse(rawdata)["scriptOverrideables"];
            if(functionName in data)
            {
                functionVariables = data[functionName]
                if(functionVariables.length === (parameters.length-1))
                {
                    boxwiseFunction = true;
                }

            }
        }
    }
    for (const param of parameters) {
        const match = param.trim().match(pattern);

        if (match == undefined || param.includes("=") || inArray(param, excludedArgs)) {
            continue;
        }
        if(boxwiseFunction)
        {
            args.push({
                var: match[1],
                type: functionVariables[parameters.indexOf(param)-1],
            });
        } else
        {
            args.push({
                var: match[1],
                type: guessType(param),
            });
        }

    }

    return args;
}

function parseKeywordArguments(parameters: string[]): KeywordArgument[] {
    const kwargs: KeywordArgument[] = [];
    const pattern = /^(\w+)(?:\s*:[^=]+)?\s*=\s*(.+)/;

    for (const param of parameters) {
        const match = param.trim().match(pattern);

        if (match == undefined) {
            continue;
        }

        kwargs.push({
            var: match[1],
            default: match[2],
            type: guessType(param),
        });
    }

    return kwargs;
}

/**
 * Check whether the annotated type is an iterator.
 * @param type The annotated type
 */
function isIterator(type: string): boolean {
    return type.startsWith("Generator") || type.startsWith("Iterator")
}

function parseReturn(parameters: string[], body: string[]): Returns {
    const returnType = parseReturnFromDefinition(parameters);

    if (returnType == undefined || isIterator(returnType.type)) {
        return parseFromBody(body, /return /);
    }

    return returnType;
}

function parseYields(parameters: string[], body: string[]): Yields {
    const parsedYield = parseReturnFromDefinition(parameters);
    const yieldType = parsedYield ? parsedYield.type : undefined;

    if (yieldType == undefined || !isIterator(yieldType)) {
        return parseFromBody(body, /yield /, `Iterator[${yieldType ? yieldType : 'type'}]`);
    } else {
        return parsedYield
    }
}

function parseReturnFromDefinition(parameters: string[]): Returns | undefined {
    const pattern = /^->\s*([\w\[\], \.]*)/;

    for (const param of parameters) {
        const match = param.trim().match(pattern);

        if (match == undefined) {
            continue;
        }

        // Skip "-> None" annotations
        return match[1] === "None" ? undefined : { type: match[1] };
    }

    return undefined;
}

function parseFromBody(body: string[], pattern: RegExp, type: string = undefined): Returns | Yields {
    for (const line of body) {
        const match = line.match(pattern);

        if (match == undefined) {
            continue;
        }

        return { type };
    }

    return undefined;
}

function parseExceptions(body: string[]): Exception[] {
    const exceptions: Exception[] = [];
    const pattern = /raise\s+([\w.]+)/;

    for (const line of body) {
        const match = line.match(pattern);

        if (match == undefined) {
            continue;
        }

        exceptions.push({ type: match[1] });
    }

    return exceptions;
}

export function inArray<type>(item: type, array: type[]) {
    return array.some((x) => item === x);
}
