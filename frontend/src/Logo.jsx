function LogoMark({ size = 40 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M11 57V28.5L32 9L53 28.5V57"
        stroke="#11263a"
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 57V38C24 35.8 25.8 34 28 34H36C38.2 34 40 35.8 40 38V57"
        stroke="#11263a"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M40 19C44 21 47 24.4 48.4 28.6"
        stroke="#2f9fcf"
        strokeWidth="3.4"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M44 12C50 15 54.6 20.6 56.6 27.4"
        stroke="#7dd5ee"
        strokeWidth="3.4"
        strokeLinecap="round"
        opacity="0.9"
      />
      <circle cx="35" cy="16" r="3.4" fill="#2f9fcf" />
    </svg>
  );
}

function Logo({ size = 40, withWordmark = true, className = "" }) {
  return (
    <span className={`armieum-logo ${className}`.trim()}>
      <LogoMark size={size} />
      {withWordmark ? (
        <span className="armieum-wordmark">
          Armieum
          <span className="armieum-wordmark-sub">Intelligent Systems</span>
        </span>
      ) : null}
    </span>
  );
}

export { LogoMark };
export default Logo;
