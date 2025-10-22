/**
 * Calculator operations with proper error handling
 */

/**
 * Represents the result of a calculator operation
 */
interface CalculatorResult {
  value: number;
  error?: string;
}

/**
 * Supported calculator operations
 */
type CalculatorOperation = 'add' | 'subtract' | 'multiply' | 'divide';

/**
 * Calculator class providing basic arithmetic operations
 */
class Calculator {
  /**
   * Adds two numbers
   * @param a - First number
   * @param b - Second number
   * @returns The sum of a and b
   */
  add(a: number, b: number): number {
    return a + b;
  }

  /**
   * Subtracts second number from first number
   * @param a - First number (minuend)
   * @param b - Second number (subtrahend)
   * @returns The difference of a and b
   */
  subtract(a: number, b: number): number {
    return a - b;
  }

  /**
   * Multiplies two numbers
   * @param a - First number
   * @param b - Second number
   * @returns The product of a and b
   */
  multiply(a: number, b: number): number {
    return a * b;
  }

  /**
   * Divides first number by second number with error handling
   * @param a - Dividend
   * @param b - Divisor
   * @returns Result object containing either the quotient or an error message
   * @throws Error when dividing by zero
   */
  divide(a: number, b: number): CalculatorResult {
    if (b === 0) {
      return {
        value: 0,
        error: 'Division by zero is not allowed'
      };
    }
    return {
      value: a / b
    };
  }

  /**
   * Performs a calculator operation safely
   * @param operation - The operation to perform
   * @param a - First operand
   * @param b - Second operand
   * @returns Result object with value or error
   */
  calculate(operation: CalculatorOperation, a: number, b: number): CalculatorResult {
    try {
      switch (operation) {
        case 'add':
          return { value: this.add(a, b) };
        case 'subtract':
          return { value: this.subtract(a, b) };
        case 'multiply':
          return { value: this.multiply(a, b) };
        case 'divide':
          return this.divide(a, b);
        default:
          return {
            value: 0,
            error: `Unsupported operation: ${operation}`
          };
      }
    } catch (error) {
      return {
        value: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

export default Calculator;
export type { CalculatorResult, CalculatorOperation };