import React from "react";
import "./Activity.css";

const Activity = ({ title, img }) => {
  return (
    <div className="main_card">
      <img src={img} alt="" />
      <p>{title}</p>
      <p className="info">
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Aliquam
        explicabo quisquam sapiente voluptatem accusamus repudiandae error ipsum
        repellat quas reiciendis magni corporis officiis autem dicta qui, vel
        harum hic ullam! Sapiente ut deserunt saepe minus placeat laudantium
        repudiandae necessitatibus eos ratione fugiat. Blanditiis suscipit
        excepturi quaerat porro culpa quod distinctio fugit libero quidem illum
        aperiam voluptates iste inventore deleniti vitae, eveniet dignissimos
        eum provident hic. Magni minima officiis eaque, nostrum eius similique
        doloremque hic, nesciunt totam ipsa libero tempore maiores?
      </p>
    </div>
  );
};

export default Activity;
