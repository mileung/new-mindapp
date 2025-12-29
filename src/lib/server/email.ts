export let sendEmail = async (config: {
	from: string;
	to: string;
	subject: string;
	html: string;
}) => {
	// const resend = new Resend(env.RESEND_API_KEY);
	// const result = await resend.emails.send(config);
	// return result;
};
