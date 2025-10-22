/**
 * Basic calculator operations with type safety and error handling
 */

/**
 * Adds two numbers together
 * @param a - The first number to add
 * @param b - The second number to add
 * @returns The sum of a and b
 * @example
 * add(2, 3) // returns 5
 */
function add(a: number, b: number): number {
  return a + b;
}

/**
 * Subtracts the second number from the first number
 * @param a - The number to subtract from
 * @param b - The number to subtract
 * @returns The difference of a and b
 * @example
 * subtract(5, 3) // returns 2
 */
function subtract(a: number, b: number): number {
  return a - b;
}

/**
 * Multiplies two numbers together
 * @param a - The first number to multiply
 * @param b - The second number to multiply
 * @returns The product of a and b
 * @example
 * multiply(3, 4) // returns 12
 */
function multiply(a: number, b: number): number {
  return a * b;
}

/**
 * Divides the first number by the second number
 * @param a - The dividend (number to be divided)
 * @param b - The divisor (number to divide by)
 * @returns The quotient of a divided by b
 * @throws {Error} When attempting to divide by zero
 * @example
 * divide(10, 2) // returns 5
 * divide(10, 0) // throws Error: "Division by zero is not allowed"
 */
function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error("Division by zero is not allowed");
  }
  return a / b;
}

export { add, subtract, multiply, divide };