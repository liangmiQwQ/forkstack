export default function DashboardPage() {
  return (
    <div className='flex flex-col gap-6'>
      <h1 className='text-2xl font-semibold'>Stacks</h1>

      <section className='card flex flex-col items-center gap-3 px-6 py-16 text-center'>
        <span className='i-lucide-layers text-3xl text-neutral-500' />
        <h2 className='font-medium'>No stacks yet</h2>
        <p className='max-w-sm text-sm text-neutral-500'>
          Stacks of pull requests from your forks will show up here.
        </p>
        <a
          href='https://github.com/pulls'
          target='_blank'
          rel='noreferrer'
          className='btn-soft mt-2'
        >
          <span className='i-simple-icons-github' />
          Your pull requests on GitHub
        </a>
      </section>
    </div>
  )
}
